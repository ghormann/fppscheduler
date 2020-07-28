const playlist=require("./lib/playlist.js")

async function test() {
   data = await playlist.readPlaylist()
   console.log(data)
}

test()
