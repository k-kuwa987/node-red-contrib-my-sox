var Client = require('node-xmpp-client');
var Pubsub = require('./node-xmpp-pubsub');

var client = new Client({
    jid: 'user@example.com',
    password: 'password',
    bosh: {
    	url: 'http://sox.ht.sfc.keio.ac.jp:5280/http-bind/',
    	wait: 60
    },
    host: 'sox.ht.sfc.keio.ac.jp',
    preferred: 'ANONYMOUS'
})

client.on('online', function() {
    console.log('online');
    // client.subscribe(device)
})

client.on('stanza', function(stanza) {
    console.log('Incoming stanza: ', stanza.toString())
})