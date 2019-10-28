// TODO: translate comments into English when complete
var DEFAULT_BOSH = 'http://sox.ht.sfc.keio.ac.jp:5280/http-bind/'
var DEFAULT_XMPP = 'sox.ht.sfc.keio.ac.jp'
var SoxConnection = require('soxjs2').SoxConnection
var Device = require('soxjs2').Device
var DeviceMeta = require('soxjs2').DeviceMeta
var MetaTransducer = require('soxjs2').MetaTransducer

module.exports = function(RED) {
  'use strict'
  function SoxCreateNode(config) {
    RED.nodes.createNode(this, config)

    this.login = RED.nodes.getNode(config.login)
    if (!this.login) {
      node.error('No credentials specified')
      return
    }

    this.device = config.device

    this.bosh = this.login.bosh || DEFAULT_BOSH
    this.xmpp = this.login.xmpp || DEFAULT_XMPP
    this.jid = this.login.jid
    this.password = this.login.password

    var node = this

    node.on('input', function(msg) {
      // console.log('------------------')
      // console.log(msg.device)
      node.client = new SoxConnection(node.bosh, node.xmpp)

      node.client.connect(() => {
        console.log('connect!')
        node.status({ fill: 'green', shape: 'dot', text: 'connected' })

        var domain = node.client.getDomain()
        var device = new Device(node.client, msg.device.device_name, domain)

        console.log(device)
        var transducer = msg.device.transducer

        var metaTransducers = []
        transducer.forEach(function(tr) {
          var name = tr.name
          var tdrId = tr.name
          var canActuate = false
          var hasOwnNode = false
          var units = tr.unit
          var unitScalar = 0
          var minValue = -50
          var maxValue = 100
          var resolution = 0.1

          var mTransducer = new MetaTransducer(
            device,
            name,
            tdrId,
            canActuate,
            hasOwnNode,
            units,
            unitScalar,
            minValue,
            maxValue,
            resolution
          )
          metaTransducers.push(mTransducer)
        })

        console.log(metaTransducers)

        var serialNumber = 'foobaahooooo'

        var deviceMeta = new DeviceMeta(
          device,
          msg.device.device_name,
          msg.device.device_type,
          serialNumber,
          metaTransducers
        )

        console.log(deviceMeta)

        var suc = function() {
          console.log('create success')
          node.send({ payload: 'Success' })
          node.status({})
        }

        var err = function(e) {
          console.log('create error')
          // console.log(e)
          node.send({ payload: 'Error' })
          node.status({ fill: 'red', shape: 'dot', text: 'error' })
        }

        // console.log('====================')
        // console.log(device)
        // console.log('---------------')
        // console.log(deviceMeta)

        node.client.createDevice(device, deviceMeta, suc, err)
      })
    })

    node.on('close', function() {
      node.client.disconnect()
      node.status({})
    })
  }
  RED.nodes.registerType('Create', SoxCreateNode)
}
