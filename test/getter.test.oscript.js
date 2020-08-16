// uses `aa-testkit` testing framework for AA tests. Docs can be found here `https://github.com/valyakin/aa-testkit`
// `mocha` standard functions and `expect` from `chai` are available globally
// `Testkit`, `Network`, `Nodes` and `Utils` from `aa-testkit` are available globally too
const path = require('path')
const AA_PATH = '../bank.oscript'

describe('Getter function', function () {
	this.timeout(120000)

	before(async () => {
		this.network = await Network.create()
			.with.numberOfWitnesses(1)
			.with.agent({ bank: path.join(__dirname, AA_PATH) })
			.with.asset({ cherries: { /*cap: 1e15*/ } })
			.with.wallet({ alice: {base: 100e9, cherries: 100e9} })
			.with.wallet({ user1: 0 })
			.with.wallet({ user2: 0 })
			.with.wallet({ user3: 0 })
			.run()
		this.alice = this.network.wallet.alice
		this.aliceAddress = await this.alice.getAddress()
		this.user1Address = await this.network.wallet.user1.getAddress()
		this.user2Address = await this.network.wallet.user2.getAddress()
		this.user3Address = await this.network.wallet.user3.getAddress()
		this.cherriesAsset = this.network.asset.cherries
		this.bank_aa = this.network.agent.bank
		this.withdrawal_fee = 2000
	})

	it('Alice distributes 4e9 cherries and 6 GB to 3 users', async () => {
		const cherriesAmount1 = 1e9
		const baseAmount2 = 2e9
		const cherriesAmount3 = 3e9
		const baseAmount1 = 4e9

		for (const aa1 of [true, false])
			for (const aa2 of [true, false])
				for (const aa3 of [true, false])
					for (const aa4 of [true, false]) {
						console.log(aa1, aa2, aa3, aa4)
						const payments = [
							{
								address: this.user1Address,
								asset: this.cherriesAsset,
								amount: cherriesAmount1,
								is_aa: aa1,
							},
							{
								address: this.user2Address,
								asset: 'base',
								amount: baseAmount2,
								is_aa: aa2,
							},
							{
								address: this.user3Address,
								asset: this.cherriesAsset,
								amount: cherriesAmount3,
								is_aa: aa3,
							},
							{
								address: this.user1Address,
								asset: 'base',
								amount: baseAmount1,
								is_aa: aa4,
							},
						];
					//	console.log(JSON.stringify(payments, null, '\t'))

						const buffer_recipients = payments.filter(payment => payment.is_aa).map(payment => {
							let p = Object.assign({}, payment)
							delete p.is_aa
						//	console.log(p)
							return p
						})
						const payment_messages1 = payments.map(payment => ({
							app: 'payment',
							payload: {
								asset: payment.asset,
								outputs: [
									{ address: payment.is_aa ? this.bank_aa : payment.address, amount: payment.amount }
								]
							}
						}))
						const assocPaymentMessages = {};
						payment_messages1.forEach(message => {
							if (assocPaymentMessages[message.payload.asset])
								assocPaymentMessages[message.payload.asset].payload.outputs.push(message.payload.outputs[0])
							else
								assocPaymentMessages[message.payload.asset] = message
						})
						const payment_messages = []
						for (let asset in assocPaymentMessages)
							payment_messages.push(assocPaymentMessages[asset])
					//	console.log(JSON.stringify(payment_messages, null, '\t'))
					//	console.log(JSON.stringify(buffer_recipients, null, '\t'))

						const { result, error: getterError } = await this.alice.executeGetter({
							aaAddress: this.bank_aa,
							getter: 'get_payment_messages',
							args: [payments]
						})
						expect(getterError).to.be.null
						expect(result).to.deep.equalInAnyOrder({
							payment_messages: payment_messages,
							buffer_recipients: buffer_recipients,
						})
					}
	})


	after(async () => {
		await this.network.stop()
	})
})
