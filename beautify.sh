#!/bin/sh

js-beautify -r index.js
find lib -name "*.js" -type f -exec js-beautify -r {} \;
