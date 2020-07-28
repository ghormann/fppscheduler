
const dataModel =require('./model.js');
const axios = require('axios');

async function doScheduleCheck() {
    dataModel.isDisplayHours = isDisplayHours();
    currentSong = await getFppStatus();
    console.log(currentSong);

    // Do Mindnight Prep


    // Do Midnight

    // Generate Midnight Names

    // If Idle
    if (currentSong.count == '0') {
       // Schedule something random here
    }
}

/*
 * Returns the curren fpp status
 */
async function getFppStatus()
{
   let res  = await axios.get("http://localhost/api/fppd/status");
   return res.data.current_playlist;
}


function isDisplayHours() {
    let myTime = new Date().toLocaleString("en-US", {
        timeZone: "America/New_York"
    });
    myTime = new Date(myTime);
    let hour = myTime.getHours();
    let month = myTime.getMonth() + 1;
    let day = myTime.getDate();

    if (month === 12 && day === 24 && hour > 17) {
        return true;
    }

    if (month === 12 && day === 31 && hour > 17) {
        return true;
    }

    if (dataModel.current.debug) {
        return true;
    }

    if (month === 12 && day === 25 && hour < 2) {
        return true;
    }

    if (month === 1 && day === 1 && hour < 2) {
        return true;
    }

    if (hour >= 6 && hour < 9) {
        return true;
    }

    if (hour >= 17 && hour < 23) {
        return true;
    }

    return false;
}

//Scheduler URL: http://192.168.6.3/api/fppd/status

module.exports.isDisplayHours = isDisplayHours;
module.exports.doScheduleCheck = doScheduleCheck;
