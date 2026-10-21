# Two independent games

## OUR BLOCK — educational cooperative town

Source: `our-block/`. Default local URL: http://localhost:3001.

```sh
cd our-block
npm ci
npm run build
npm start
```

Use `npm run dev` during development. One to four players can join a private town via its invitation link. Open a new browser session to play a second resident; reloading recovers your current seat. The Unity client source is in `our-block/unity/`; see its README for its unverified build status.

## LAST LIGHT — preserved original

Source, original documentation, tests, assets and saved local database are in `last-light/`. Default URL: http://localhost:3000.

```sh
cd last-light
npm ci
npm run build
npm start
```

The games have independent dependencies, databases and ports. They can run simultaneously.

A verified source-and-data archive and SHA-256 checksum are in `backups/last-light-20261020-121538.tar.gz` and its `.sha256` sidecar. The archive excludes reinstallable dependencies and generated builds. Do not publish it: it contains local seat recovery tokens. Extract into a fresh directory, run `npm ci`, build and start to restore. Never extract over an active game directory.

Both games require Node.js 24+. Public deployment and real-person/device acceptance checks are documented inside OUR BLOCK.
