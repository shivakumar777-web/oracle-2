#!/bin/bash
cd /teamspace/studios/this_studio/oracle-2/frontend-manthana/manthana
node --env-file=.env.local scripts/debug-ses.mjs "$1"
