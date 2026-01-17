# fppscheduler
A node based scheduler that runs along side of FPP and schedules songs to run.  It works with https://github.com/ghormann/Christmas-Vote-now to get the mosted voted song. Note that this project was never designed for use outside of my personal display so some code tweeks will be needed if you attempt to use it.

## Docker Repository

This project is automatically built and published as a Docker image to a private repo using GitHub Actions.

### Semantic Versioning

The project uses semantic versioning with the following rules:
- **Patch** version bump (x.x.+1): Default for any commit to main
- **Minor** version bump (x.+1.0): When commit message starts with `feat:` or `feat(`
- **Major** version bump (+1.0.0): When commit message contains `BREAKING CHANGE` or uses `!` (e.g., `feat!:`, `fix!:`)

#### Manual Releases

You can also create releases manually using the "Create Release" workflow:
1. Go to the "Actions" tab in your GitHub repository
2. Select "Create Release" workflow
3. Click "Run workflow"
4. Choose the version type (patch/minor/major) and whether it's a pre-release
5. Click "Run workflow"

This will:
- Update the version in package.json
- Create a git tag
- Create a GitHub release with changelog
- Trigger the Docker build and push

#### Available Docker Tags

The following tags are automatically created:
- `latest`: Latest build from main branch
- `vX.Y.Z`: Specific version tag
- `vX.Y`: Major.minor version
- `vX`: Major version only

## Setup
1. NOTE: This code runs as a sepereate docker container and connects to yourS FPP box.   It should work for both BBB and PI versions of FPP, but has only been tested on Pi.   It also requires version FPP 4.1 or greater.
1. In FPP, your playlist should have a description defined. This will be the "nice name" that will be displayded on the voting website.
1. Install the preqs with **sudo apt install nodejs npm**
1. Clone this repo to somewhere on the fpp box.  (I use /home/fpp/src/fppscheduler, but it really doesn't matter)
1. If you plan to use the "short show" feature, you need to modify lib/mode.js to be the list of playlists to be used during a short show.
1. You'll need to modify internal_songs in lib/model.js.   This should be list of Playlist that will be scheculed regardless of the next voted song. (These are often bumpers or intros).  An empty array can be used if the top voted song should always be played. 
1. run **npm install** to download and install all the pre-reqs. 

## Running the program
1. run **node .**

## Notes
1. lib/mymqtt.js shows the MQTT topic names.  It does assume that fpp has been configured with "christmas/" as the MQTT prefix for topics
1. lib/scheduler.js does have some hard coded playlist names for special features.  These all start with "Internal_"
1. By default, lib/playlist.js won't share playlist that start with "Test" or "Internal" with the voting website, all other play list will be avaiable for users to vote upon. 
