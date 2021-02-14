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
pkill -INT -f "zone server"
```

zone currently takes config via environmental variables:
```
export PORT=443;
export AUTH_PASSWORD=scooter;
export LIBRARY_ORIGIN=http://127.0.0.1:4000/library;
export YOUTUBE_ORIGIN=http://127.0.0.1:4001/youtube;
export YOUTUBE_AUTHORIZATION="Bearer some_token";
```

zone relies on zone-library and zone-youtube repos for media

# zone libraries api

## search for items
```
GET /?q=search%20terms
```
list/search/filter library

## item metadata
```
GET /:id
```
json metadata for a particular library item e.g `{ mediaId: "some_id" title: "demo song", duration: 30000, src: "https://example.com/demo-song.mp3" }`

## item availability
```
GET /:id/status
```

json string for availability of a particular library item e.g `"available"` `"none"` `"failed"` `"requested"`

## request item
```
POST /:id/request
```
request a particular library item be made available for playback
