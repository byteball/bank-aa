// uses `aa-testkit` testing framework for AA tests. Docs can be found here `https://github.com/valyakin/aa-testkit`
// `mocha` standard functions and `expect` from `chai` are available globally
// `Testkit`, `Network`, `Nodes` and `Utils` from `aa-testkit` are available globally too
const path = require('path')
const AA_PATH = '../bank.oscript'

describe('Deposits, transfers, and withdrawals', function () {
	this.timeout(120000)

	before(async () => {
		this.network = await Network.create()
			.with.numberOfWitnesses(1)
			.with.agent({ bank: path.join(__dirname, AA_PATH) })
			.with.asset({ cherries: { /*cap: 1e15*/ } })
			.with.wallet({ alice: {base: 100e9, cherries: 100e9} })
			.with.wallet({ bob: 100e9 })
			.run()
		this.alice = this.network.wallet.alice
		this.aliceAddress = await this.alice.getAddress()
		this.bob = this.network.wallet.bob
		this.bobAddress = await this.bob.getAddress()
		this.cherriesAsset = this.network.asset.cherries
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

	it('Alice deposits 10e9 cherries to the bank', async () => {
		const amount = 10e9
		const { unit, error } = await this.alice.sendMulti({
			asset: this.cherriesAsset,
			base_outputs: [{ address: this.bank_aa, amount: 1e4 }],
			asset_outputs: [{ address: this.bank_aa, amount: amount }],
			spend_unconfirmed: 'all',
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		this.aliceBaseBalance += 10000

		const { vars } = await this.alice.readAAStateVars(this.bank_aa)
		console.log(vars)
		expect(vars['balance_' + this.aliceAddress + '_base']).to.be.equal(this.aliceBaseBalance)
		expect(vars['balance_' + this.aliceAddress + '_' + this.cherriesAsset]).to.be.equal(amount)
		this.aliceCherriesBalance = amount
	})

	it('Alice withdraws 0.1 GB', async () => {
		const amount = 0.1e9
		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.bank_aa,
			amount: 10000,
			data: {
				withdraw: 1,
				asset: 'base',
				amount: amount
			}
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit

		this.aliceBaseBalance += - amount + 10000 - this.withdrawal_fee

		const { vars } = await this.alice.readAAStateVars(this.bank_aa)
		console.log(vars)
		expect(vars['balance_' + this.aliceAddress + '_base']).to.be.equal(this.aliceBaseBalance)
		expect(vars['balance_' + this.aliceAddress + '_' + this.cherriesAsset]).to.be.equal(this.aliceCherriesBalance)

		const { unitObj } = await this.alice.getUnitInfo({ unit: response.response_unit })
	//	console.log(JSON.stringify(unitObj, null, '\t'))
		expect(Utils.getExternalPayments(unitObj)).to.deep.equalInAnyOrder([
			{
				address: this.aliceAddress,
				amount: amount,
			},
		])
	})

	it('Alice transfers 0.1 GB to Bob', async () => {
		const amount = 0.1e9
		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.bank_aa,
			amount: 10000,
			data: {
				transfer: 1,
				asset: 'base',
				amount: amount,
				to: this.bobAddress,
			}
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		this.aliceBaseBalance += - amount + 10000
		this.bobBaseBalance = amount

		const { vars } = await this.alice.readAAStateVars(this.bank_aa)
		console.log(vars)
		expect(vars['balance_' + this.bobAddress + '_base']).to.be.equal(this.bobBaseBalance)
		expect(vars['balance_' + this.aliceAddress + '_base']).to.be.equal(this.aliceBaseBalance)
		expect(vars['balance_' + this.aliceAddress + '_' + this.cherriesAsset]).to.be.equal(this.aliceCherriesBalance)
	})

	it('Alice transfers 3e9 cherries to Bob', async () => {
		const amount = 3e9
		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.bank_aa,
			amount: 10000,
			data: {
				transfer: 1,
				asset: this.cherriesAsset,
				amount: amount,
				to: this.bobAddress,
			}
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		this.aliceBaseBalance += 10000
		this.aliceCherriesBalance -= amount
		this.bobCherriesBalance = amount

		const { vars } = await this.alice.readAAStateVars(this.bank_aa)
		console.log(vars)
		expect(vars['balance_' + this.bobAddress + '_base']).to.be.equal(this.bobBaseBalance)
		expect(vars['balance_' + this.aliceAddress + '_base']).to.be.equal(this.aliceBaseBalance)
		expect(vars['balance_' + this.aliceAddress + '_' + this.cherriesAsset]).to.be.equal(this.aliceCherriesBalance)
		expect(vars['balance_' + this.bobAddress + '_' + this.cherriesAsset]).to.be.equal(this.bobCherriesBalance)
	})

	it('Alice tries to withdraw the entire balance without accounting for fees and fails', async () => {
		const amount = this.aliceBaseBalance
		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.bank_aa,
			amount: 10000,
			data: {
				withdraw: 1,
				asset: 'base',
				amount: amount
			}
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		expect(response.response.error).to.be.equal(`trying to withdraw more than you have: ${this.aliceBaseBalance+this.withdrawal_fee} > ${this.aliceBaseBalance}`)
		expect(response.bounced).to.be.true
		expect(response.response_unit).to.be.null

	})

	it('Alice withdraws the rest', async () => {
		const amount = this.aliceBaseBalance - this.withdrawal_fee
		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.bank_aa,
			amount: 10000,
			data: {
				withdraw: 1,
				asset: 'base',
				amount: 'all'
			}
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit

		this.aliceBaseBalance = 10000

		const { vars } = await this.alice.readAAStateVars(this.bank_aa)
		console.log(vars)
		expect(vars['balance_' + this.aliceAddress + '_base']).to.be.equal(this.aliceBaseBalance)
		expect(vars['balance_' + this.aliceAddress + '_' + this.cherriesAsset]).to.be.equal(this.aliceCherriesBalance)

		const { unitObj } = await this.alice.getUnitInfo({ unit: response.response_unit })
	//	console.log(JSON.stringify(unitObj, null, '\t'))
		expect(Utils.getExternalPayments(unitObj)).to.deep.equalInAnyOrder([
			{
				address: this.aliceAddress,
				amount: amount,
			},
		])
	})

	it('Alice withdraws all the cherries', async () => {
		const amount = this.aliceCherriesBalance
		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.bank_aa,
			amount: 10000,
			data: {
				withdraw: 1,
				asset: this.cherriesAsset,
				amount: 'all'
			}
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit

		this.aliceBaseBalance += 10000 - this.withdrawal_fee

		const { vars } = await this.alice.readAAStateVars(this.bank_aa)
		console.log(vars)
		expect(vars['balance_' + this.aliceAddress + '_base']).to.be.equal(this.aliceBaseBalance)
		expect(vars['balance_' + this.aliceAddress + '_' + this.cherriesAsset]).to.be.equal(0)

		const { unitObj } = await this.alice.getUnitInfo({ unit: response.response_unit })
	//	console.log(JSON.stringify(unitObj, null, '\t'))
		expect(Utils.getExternalPayments(unitObj)).to.deep.equalInAnyOrder([
			{
				asset: this.cherriesAsset,
				address: this.aliceAddress,
				amount: amount,
			},
		])
	})

	it('Bob withdraws all the cherries using an explicit amount', async () => {
		const amount = this.bobCherriesBalance
		const { unit, error } = await this.bob.triggerAaWithData({
			toAddress: this.bank_aa,
			amount: 10000,
			data: {
				withdraw: 1,
				asset: this.cherriesAsset,
				amount: amount
			}
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.bob, unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit

		this.bobBaseBalance += 10000 - this.withdrawal_fee

		const { vars } = await this.bob.readAAStateVars(this.bank_aa)
		console.log(vars)
		expect(vars['balance_' + this.bobAddress + '_base']).to.be.equal(this.bobBaseBalance)
		expect(vars['balance_' + this.bobAddress + '_' + this.cherriesAsset]).to.be.equal(0)

		const { unitObj } = await this.bob.getUnitInfo({ unit: response.response_unit })
	//	console.log(JSON.stringify(unitObj, null, '\t'))
		expect(Utils.getExternalPayments(unitObj)).to.deep.equalInAnyOrder([
			{
				asset: this.cherriesAsset,
				address: this.bobAddress,
				amount: amount,
			},
		])
	})

	it('Bob withdraws all bytes', async () => {
		const amount = this.bobBaseBalance - this.withdrawal_fee
		const { unit, error } = await this.bob.triggerAaWithData({
			toAddress: this.bank_aa,
			amount: 10000,
			data: {
				withdraw: 1,
				asset: 'base',
				amount: 'all'
			}
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.bob, unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit

		this.bobBaseBalance = 10000

		const { vars } = await this.bob.readAAStateVars(this.bank_aa)
		console.log(vars)
		expect(vars['balance_' + this.bobAddress + '_base']).to.be.equal(this.bobBaseBalance)
		expect(vars['balance_' + this.bobAddress + '_' + this.cherriesAsset]).to.be.equal(0)

		const { unitObj } = await this.bob.getUnitInfo({ unit: response.response_unit })
	//	console.log(JSON.stringify(unitObj, null, '\t'))
		expect(Utils.getExternalPayments(unitObj)).to.deep.equalInAnyOrder([
			{
				address: this.bobAddress,
				amount: amount,
			},
		])
	})

	after(async () => {
		await this.network.stop()
	})
})
