// uses `aa-testkit` testing framework for AA tests. Docs can be found here `https://github.com/valyakin/aa-testkit`
// `mocha` standard functions and `expect` from `chai` are available globally
// `Testkit`, `Network`, `Nodes` and `Utils` from `aa-testkit` are available globally too
const crypto = require('crypto')
const path = require('path')
const signature = require('ocore/signature.js')
const { expect } = require('chai')
const AA_PATH = '../bank.oscript'

function sha256(str) {
	return crypto.createHash("sha256").update(str, "utf8").digest("base64")
}

describe('Auuthorized keys', function () {
	this.timeout(120000)

	before(async () => {
		this.network = await Network.create()
			.with.numberOfWitnesses(1)
			.with.agent({ bank: path.join(__dirname, AA_PATH) })
			.with.wallet({ alice: 100e9 })
			.with.wallet({ bob: 100e9 })
			.with.wallet({ charlie: 100e9 })
			.run()
		this.alice = this.network.wallet.alice
		this.aliceAddress = await this.alice.getAddress()
		this.bob = this.network.wallet.bob
		this.bobAddress = await this.bob.getAddress()
		this.charlie = this.network.wallet.charlie
		this.charlieAddress = await this.charlie.getAddress()
		this.bank_aa = this.network.agent.bank
		this.withdrawal_fee = 2000
	})

	it('Alice deposits 1 GB to the bank', async () => {
		const amount = 1e9
		const { unit, error } = await this.alice.sendBytes({
			toAddress: this.bank_aa,
			amount: amount,
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		const { vars } = await this.alice.readAAStateVars(this.bank_aa)
		console.log(vars)
		expect(vars['balance_' + this.aliceAddress + '_base']).to.be.equal(amount)
		this.aliceBaseBalance = amount
	})

	it('Alice authorizes a key', async () => {
		const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
			modulusLength: 2048,
			publicKeyEncoding: {
				type: 'spki',
				format: 'pem'
			},
			privateKeyEncoding: {
				type: 'pkcs1',
				format: 'pem',
			}
		})
		this.publicKey = publicKey
		this.privateKey = privateKey
		this.keyHash = sha256(publicKey)
		console.log('public key', publicKey)
		console.log('private key', privateKey)

		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.bank_aa,
			amount: 10000,
			data: {
				authorize_key: 1,
				pubkey: publicKey
			}
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		const { vars } = await this.alice.readAAStateVars(this.bank_aa)
		console.log(vars)
		expect(vars['key_' + this.aliceAddress + '_' + this.keyHash]).to.be.equal(1)
	})

	it('Alice withdraws 0.1 GB signing with an authorized key, Charlie submits the request', async () => {
		const amount = 0.1e9
		const message = "withdraw " + amount + " " + 'base' + " to " + "self"
		const sig = signature.signMessageWithRsaPemPrivKey(message, 'base64', this.privateKey)
		expect(sig).to.be.a('string')
		console.log('sig', sig)

		const { unit, error } = await this.charlie.triggerAaWithData({
			toAddress: this.bank_aa,
			amount: 10000,
			data: {
				withdraw: 1,
				asset: 'base',
				amount: amount,
				owner: this.aliceAddress,
				pubkey: this.publicKey,
				nonce: 1,
				signature: sig,
			}
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.charlie, unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit

		this.aliceBaseBalance += - amount + 10000 - this.withdrawal_fee

		const { vars } = await this.charlie.readAAStateVars(this.bank_aa)
		console.log(vars)
		expect(vars['balance_' + this.aliceAddress + '_base']).to.be.equal(this.aliceBaseBalance)

		const { unitObj } = await this.charlie.getUnitInfo({ unit: response.response_unit })
	//	console.log(JSON.stringify(unitObj, null, '\t'))
		expect(Utils.getExternalPayments(unitObj)).to.deep.equalInAnyOrder([
			{
				address: this.aliceAddress,
				amount: amount,
			},
		])
	})



	after(async () => {
		await this.network.stop()
	})
})
