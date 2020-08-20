// uses `aa-testkit` testing framework for AA tests. Docs can be found here `https://github.com/valyakin/aa-testkit`
// `mocha` standard functions and `expect` from `chai` are available globally
// `Testkit`, `Network`, `Nodes` and `Utils` from `aa-testkit` are available globally too
const path = require('path')
const AA_PATH = '../bank.oscript'

describe('Recipients', function () {
	this.timeout(120000)

	before(async () => {
		this.network = await Network.create()
			.with.numberOfWitnesses(1)
			.with.agent({ bank: path.join(__dirname, AA_PATH) })
			.with.asset({ cherries: { /*cap: 1e15*/ } })
			.with.wallet({ alice: {base: 100e9, cherries: 100e9} })
			.with.wallet({ user1: 1e6 })
			.with.wallet({ user2: 0 })
			.with.wallet({ user3: 0 })
			.run()
		this.alice = this.network.wallet.alice
		this.user1 = this.network.wallet.user1
		this.aliceAddress = await this.alice.getAddress()
		this.user1Address = await this.network.wallet.user1.getAddress()
		this.user2Address = await this.network.wallet.user2.getAddress()
		this.user3Address = await this.network.wallet.user3.getAddress()
		this.cherriesAsset = this.network.asset.cherries
		this.bank_aa = this.network.agent.bank
		this.withdrawal_fee = 2000
	})

	it('Alice distributes 5 GB to bank accounts of 2 users', async () => {
		const amount1 = 2e9
		const amount2 = 3e9
		const amount = amount1 + amount2
		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.bank_aa,
			amount: amount,
			data: {
				recipients: [
					{
						address: this.user1Address,
						asset: 'base',
						amount: amount1,
					},
					{
						address: this.user2Address,
						asset: 'base',
						amount: amount2,
					},
				]
			}
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		this.user1BaseBalance = amount1
		this.user2BaseBalance = amount2

		const { vars } = await this.alice.readAAStateVars(this.bank_aa)
		console.log(vars)
		expect(vars['balance_' + this.user1Address + '_base']).to.be.equal(this.user1BaseBalance)
		expect(vars['balance_' + this.user2Address + '_base']).to.be.equal(this.user2BaseBalance)
	})

	it('Alice distributes 4e9 cherries and 6 GB to bank accounts of 3 users', async () => {
		const cherriesAmount1 = 1e9
		const baseAmount2 = 2e9
		const cherriesAmount3 = 3e9
		const baseAmount1 = 4e9

		const { unit, error } = await this.alice.sendMulti({
			asset: this.cherriesAsset,
			base_outputs: [{ address: this.bank_aa, amount: baseAmount1 + baseAmount2 }],
			asset_outputs: [{ address: this.bank_aa, amount: cherriesAmount1 + cherriesAmount3 }],
			spend_unconfirmed: 'all',
			messages: [{
				app: 'data',
				payload: {
					recipients: [
						{
							address: this.user1Address,
							asset: this.cherriesAsset,
							amount: cherriesAmount1,
						},
						{
							address: this.user2Address,
							asset: 'base',
							amount: baseAmount2,
						},
						{
							address: this.user3Address,
							asset: this.cherriesAsset,
							amount: cherriesAmount3,
						},
						{
							address: this.user1Address,
							asset: 'base',
							amount: baseAmount1,
						},
					]
				}
			}]
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		this.user1BaseBalance += baseAmount1
		this.user2BaseBalance += baseAmount2
		this.user1CherriesBalance = cherriesAmount1
		this.user3CherriesBalance = cherriesAmount3

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null


		const { vars } = await this.alice.readAAStateVars(this.bank_aa)
		console.log(vars)
		expect(vars['balance_' + this.user1Address + '_base']).to.be.equal(this.user1BaseBalance)
		expect(vars['balance_' + this.user2Address + '_base']).to.be.equal(this.user2BaseBalance)
		expect(vars['balance_' + this.user1Address + '_' + this.cherriesAsset]).to.be.equal(this.user1CherriesBalance)
		expect(vars['balance_' + this.user3Address + '_' + this.cherriesAsset]).to.be.equal(this.user3CherriesBalance)
	})


	it('User1 tries to distribute more than he has in his bank and fails', async () => {
		const cherriesAmount1 = 0.1e9
		const baseAmount2 = 2e9
		const cherriesAmount3 = 0.3e9
		const baseAmountAlice = 4e9

		const recipients = [
			{
				address: this.user1Address,
				asset: this.cherriesAsset,
				amount: cherriesAmount1,
			},
			{
				address: this.user2Address,
				asset: 'base',
				amount: baseAmount2,
			},
			{
				address: this.user3Address,
				asset: this.cherriesAsset,
				amount: cherriesAmount3,
			},
			{
				address: this.aliceAddress,
				asset: 'base',
				amount: baseAmountAlice,
			},
		];

		const { unit, error } = await this.user1.triggerAaWithData({
			toAddress: this.bank_aa,
			amount: 1e4,
			spend_unconfirmed: 'all',
			data: {
				withdraw: 1,
				recipients: recipients
			}
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.user1, unit)
		expect(response.response.error).to.be.equal("not enough balance in base")
		expect(response.bounced).to.be.true
		expect(response.response_unit).to.be.null

	})

	it('User1 distributes 1e9 cherries and 5 GB to 4 users from his bank', async () => {
		const cherriesAmount1 = 0.7e9
		const baseAmount2 = 2e9
		const cherriesAmount3 = 0.3e9
		const baseAmountAlice = 3e9

		const recipients = [
			{
				address: this.user1Address,
				asset: this.cherriesAsset,
				amount: cherriesAmount1,
			},
			{
				address: this.user2Address,
				asset: 'base',
				amount: baseAmount2,
			},
			{
				address: this.user3Address,
				asset: this.cherriesAsset,
				amount: cherriesAmount3,
			},
			{
				address: this.aliceAddress,
				asset: 'base',
				amount: baseAmountAlice,
			},
		];

		const { unit, error } = await this.user1.triggerAaWithData({
			toAddress: this.bank_aa,
			amount: 1e4,
			spend_unconfirmed: 'all',
			data: {
				withdraw: 1,
				recipients: recipients
			}
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		this.user1BaseBalance -= baseAmountAlice + baseAmount2 + recipients.length * this.withdrawal_fee
		this.user1CherriesBalance -= cherriesAmount1 + cherriesAmount3

		const { response } = await this.network.getAaResponseToUnitOnNode(this.user1, unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit


		const { vars } = await this.user1.readAAStateVars(this.bank_aa)
		console.log(vars)
		expect(vars['balance_' + this.user1Address + '_base']).to.be.equal(this.user1BaseBalance)
		expect(vars['balance_' + this.user2Address + '_base']).to.be.equal(this.user2BaseBalance)
		expect(vars['balance_' + this.user1Address + '_' + this.cherriesAsset]).to.be.equal(this.user1CherriesBalance)
		expect(vars['balance_' + this.user3Address + '_' + this.cherriesAsset]).to.be.equal(this.user3CherriesBalance)

		recipients.forEach(recipient => {
			if (recipient.asset === 'base')
				delete recipient.asset;
		})

		const { unitObj } = await this.user1.getUnitInfo({ unit: response.response_unit })
	//	console.log(JSON.stringify(unitObj, null, '\t'))
		expect(Utils.getExternalPayments(unitObj)).to.deep.equalInAnyOrder(recipients)
	})


	after(async () => {
		await this.network.stop()
	})
})
