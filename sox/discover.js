var DEFAULT_BOSH = 'http://sox.ht.sfc.keio.ac.jp:5280/http-bind/'
var DEFAULT_XMPP = 'sox.ht.sfc.keio.ac.jp'
var SoxConnection = require('soxjs2').SoxConnection

module.exports = function(RED) {
  'use strict'
  function SoxDiscoverNode(config) {
    RED.nodes.createNode(this, config)

    this.login = RED.nodes.getNode(config.login) // Retrieve the config node
    if (!this.login) {
      node.error('No credentials specified')
      return
    }

    this.bosh = this.login.bosh || DEFAULT_BOSH
    this.xmpp = this.login.xmpp || DEFAULT_XMPP
    this.jid = this.login.jid
    this.password = this.login.password

    var node = this

    node.on('input', function() {
      console.log('hooo this is discover!')

      this.client = new SoxConnection(this.bosh, this.xmpp)

      node.client.connect(() => {
        console.log('sox connected')
        this.client.fetchDevices(function(devices) {
          console.log(devices)
          for (var i = 0; i < devices.length; i++) {
            var device = devices[i]
            console.log(device.getName())
          }
          // 接続終了
          node.client.disconnect()
          console.log('@@@ disconnected')
        })
      })
    })
  }
  RED.nodes.registerType('Discover', SoxDiscoverNode)
}
