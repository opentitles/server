/* eslint-disable */
const http = require('http');

const options = {
  host: 'localhost',
  port: process.env.PORT || 8059,
  path: '/v2/country/nl/org/NOS/article/2353584',
  timeout: 2000
};

const request = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  if (res.statusCode === 200) {
    process.exit(0);
  }
  else {
    process.exit(1);
  }
});

request.on('error', function (err) {
  console.log('ERROR');
  console.log(err);
  process.exit(1);
});

request.end();