const basedir = "/home/fpp/media/playlists/"
const glob = require('glob');
const fs = require('fs');

function readPlaylist() {
    return new Promise(function(resolve, reject) {
        glob(basedir + '*.json', function(err, files) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                rc = [];
                files.forEach(function(f) {
                    console.log(f)
                    fs.readFile(f, (err, data) => {
                        if (err) {
                            reject(err)
                        } else {
                            let item = JSON.parse(data);
                            rc.push(item)
                            if (rc.length === files.length) {
                                resolve(rc)
                            }
                        }
                    });
                });
            }
        });
    });
}

module.exports.readPlaylist = readPlaylist