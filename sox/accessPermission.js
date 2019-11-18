// TODO: translate comments into English when complete
const DEFAULT_BOSH = 'http://sox.ht.sfc.keio.ac.jp:5280/http-bind/'
const DEFAULT_XMPP = 'sox.ht.sfc.keio.ac.jp'
const SoxConnection = require('soxjs2').SoxConnection

module.exports = function(RED) {
  'use strict'
  function SoxAccsessPermissionNode(config) {
    RED.nodes.createNode(this, config)

    if (!config.device) {
      this.error('No device specified')
      return
    }

    this.login = RED.nodes.getNode(config.login) // Retrieve the config node
    if (!this.login) {
      node.status({
        fill: 'red',
        shape: 'dot',
        text: 'Credential error'
      })
      node.error('No credentials specified')
      return
    }

    this.devices = config.device

    this.bosh = this.login.bosh || DEFAULT_BOSH
    this.xmpp = this.login.xmpp || DEFAULT_XMPP
    this.jid = this.login.jid
    this.password = this.login.password

    var node = this

    function setAccessPermission() {
      console.log('func!')
      node.client = new SoxConnection(node.bosh, node.xmpp)
      node.client.connect(() => {
        var dn = config.device
        var domain = node.client.getDomain()
        var accessModel = config.accessmodel
        var affaliate = [
          'mina@sox.ht.sfc.keio.ac.jp',
          'takuro@sox.ht.sfc.keio.ac.jp'
        ]

        console.log(dn)
        console.log(domain)
        console.log(accessModel)
        console.log(affaliate)

        // affaliate callback
        var sucAf = function() {
          console.log('\n\n@@@@ suc affaliate\n\n')
        }
        var errAf = function() {
          console.log('\n\n@@@@ err affaliate\n\n')
        }

        // accessModel callback
        var sucAm = function() {
          console.log('\n\n@@@@ suc accessModel\n\n')
          if (accessModel == 'whitelist') {
            node.client.setAffaliation(dn, domain, affaliate, sucAf, errAf)
          }
        }
        var errAm = function(result) {
          console.log('\n\n@@@@ err accessModel\n\n')
          console.log(result.outerHTML)
        }

        node.client.setAccessPermission(dn, domain, accessModel, sucAm, errAm)
      })
    }

    node.on('input', function() {
      console.log('hoo! i am access perm')
      setAccessPermission()
    })
  }
  RED.nodes.registerType('AccsessPermission', SoxAccsessPermissionNode)
}
