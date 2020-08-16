# Bank AA

Autononomous Agent that stores user balances in various assets and allows to withdraw or transfer them to another user at any time.

It serves two purposes:
1. AAs that need to send money to other AAs and are concerned about the payment being bounced (and therefore failing the entire chain of AA triggers) can send the money to this bank AA instead. The recipients can later withdraw the money. Thus the AA is use as a temporary buffer.
2. Allow users and devices to sign transactions with various keys, e.g. when a IoT device has a non-removable key that is different from the user's standard Obyte key or uses a different signature algorithm. User sends an authorization command to the AA in order to authorize a key to sign on user's behalf.


## Usage

### Run tests

```bash
npm run test
# or
yarn test
```

### Lint test files

```bash
npm run lint
# or
yarn lint
```
