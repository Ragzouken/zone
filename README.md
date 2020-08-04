# zone server

web socket server for hosting a zone


## hints for running your own zone

rebuild zone after updating:
```
npm install
npm run build
```

run zone;
```
npm start
```

zone responds to interrupt by saving the current state (playlist, bans, blocks) and shutting down
```
pkill -INT node
```

zone currently takes config via environmental variables:
```
export PORT=443;
export CERT_PATH=fullchain.pem
export KEY_PATH=privkey.pem

export AUTH_PASSWORD=scooter;
```

zone looks for any .mp4 and .mp3 files in ./media/ and makes them available for local playback e.g `filename.mp4` can be played as `/local filename`. use `/admin refresh-videos` to refresh the list while zone is running.
