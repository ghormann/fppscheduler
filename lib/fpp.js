const axios = require("axios");

class FPPApi {
    constructor(ip_addr) {
        this.ip_addr = ip_addr;
    }

    /*
     * Returns a promise for the current fpp status
     */
    async getFppStatus() {
        const url = "http://" + this.ip_addr + "/api/fppd/status";
        let fallback = {
            current_playlist: { count: "0", description: "", index: "0", playlist: "", type: "" },
            current_song: "",
        };
        let rc = await axiosGetLogger(url, fallback);
        return rc;
    }

    async playNow(playlist) {
        console.log("Starting :", playlist);
        const url = "http://" + this.ip_addr + "/api/playlist/" + playlist + "/start";
        let fallback = {
            fppStatus: {
                current_playlist: "",
            },
        };
        return await axiosGetLogger(url, fallback);
    }
}

async function axiosGetLogger(url, fallback) {
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            // Handle Axios errors
            console.error("Axios Error:", error.message);
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                console.error("Response data:", error.response.data);
                console.error("Response status:", error.response.status);
                console.error("Response headers:", error.response.headers);
            } else if (error.request) {
                // The request was made but no response was received
                //console.error("Request:", error.request);
                console.error('No response received');
            } else {
                // Something happened in setting up the request that triggered an Error
                console.error("Error:", error.message);
            }
        } else {
            // Handle other errors
            console.error("Error:", error);
        }
        return new Promise((resolve, reject) => {
            resolve(fallback);
        });
    }
}

module.exports.FPPApi = FPPApi;