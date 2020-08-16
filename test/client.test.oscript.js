// uses `aa-testkit` testing framework for AA tests. Docs can be found here `https://github.com/valyakin/aa-testkit`
// `mocha` standard functions and `expect` from `chai` are available globally
// `Testkit`, `Network`, `Nodes` and `Utils` from `aa-testkit` are available globally too
const path = require('path')
const { expect } = require('chai')
const AA_PATH = '../bank.oscript'

describe('A client AA uses the bank in order to buffer the payments to AA addresses', function () {
	this.timeout(120000)

	before(async () => {
		this.network = await Network.create()
			.with.numberOfWitnesses(1)
			.with.agent({ bank: path.join(__dirname, AA_PATH) })
			.with.agent({ eater: path.join(__dirname, 'eater.oscript') })
			.with.agent({ eater2: path.join(__dirname, 'eater2.oscript') })
			.with.agent({ client: path.join(__dirname, 'client.oscript') })
			.with.asset({ cherries: { /*cap: 1e15*/ } })
			.with.wallet({ alice: {base: 100e9, cherries: 100e9} })
			.with.wallet({ user1: 0 })
			.run()
		this.alice = this.network.wallet.alice
		this.aliceAddress = await this.alice.getAddress()
		this.user1Address = await this.network.wallet.user1.getAddress()
		this.cherriesAsset = this.network.asset.cherries
		this.bank_aa = this.network.agent.bank
		this.client_aa = this.network.agent.client
		this.eater_aa = this.network.agent.eater
		this.eater2_aa = this.network.agent.eater2
		this.withdrawal_fee = 2000
	})

	it('Alice deposits 10000 bytes to the bank to make sure it has enough bytes for storage fees', async () => {
		const amount = 10000
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
	})

	it('Alice sends cherries to the client AA which forwards them to users and AAs', async () => {
		const amount1 = 1e9
		const amount2 = 2e9
		const amount3 = 3e9

		const { unit, error } = await this.alice.sendMulti({
			asset: this.cherriesAsset,
			base_outputs: [{ address: this.client_aa, amount: 1e4 }],
			asset_outputs: [{ address: this.client_aa, amount: amount1 + amount2 + amount3 }],
			spend_unconfirmed: 'all',
			messages: [{
				app: 'data',
				payload: {
					address1: this.user1Address,
					asset1: this.cherriesAsset,
					amount1: amount1,
					address2: this.eater_aa,
					asset2: this.cherriesAsset,
					amount2: amount2,
					address3: this.eater2_aa,
					asset3: this.cherriesAsset,
					amount3: amount3,
				}
			}]
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit


		const { vars } = await this.alice.readAAStateVars(this.bank_aa)
		console.log(vars)
		expect(vars['balance_' + this.eater_aa + '_' + this.cherriesAsset]).to.be.equal(amount2)
		expect(vars['balance_' + this.eater2_aa + '_' + this.cherriesAsset]).to.be.equal(amount3)
		expect(vars['balance_' + this.user1Address + '_' + this.cherriesAsset]).to.be.undefined

		const { unitObj } = await this.alice.getUnitInfo({ unit: response.response_unit })
	//	console.log(JSON.stringify(unitObj, null, '\t'))
		expect(Utils.getExternalPayments(unitObj)).to.deep.equalInAnyOrder([
			{
				asset: this.cherriesAsset,
				address: this.user1Address,
				amount: amount1,
			},
			{
				asset: this.cherriesAsset,
				address: this.bank_aa,
				amount: amount2,
			},
			{
				asset: this.cherriesAsset,
				address: this.bank_aa,
				amount: amount3,
			},
		])
		const data = unitObj.messages.find(message => message.app === 'data').payload
		expect(data).to.deep.equalInAnyOrder({
			recipients: [
				{
					asset: this.cherriesAsset,
					address: this.eater_aa,
					amount: amount2,
				},
				{
					asset: this.cherriesAsset,
					address: this.eater2_aa,
					amount: amount3,
				},	
			]
		})
	})


	after(async () => {
		await this.network.stop()
	})
})
