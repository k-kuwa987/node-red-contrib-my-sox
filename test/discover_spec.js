var should = require('should')
var helper = require('node-red-node-test-helper')
var discoverNode = require('../sox/discover')

helper.init(require.resolve('node-red'))

describe('Discover Node', function() {
  beforeEach(function(done) {
    helper.startServer(done)
  })

  afterEach(function(done) {
    helper.unload()
    helper.stopServer(done)
  })

  it('should be loaded', function(done) {
    var flow = [
      {
        id: 'discoverNode1',
        type: 'Discover',
        name: 'Discover Devices'
      }
    ]
    helper.load(discoverNode, flow, function() {
      var n1 = helper.getNode('discoverNode1')
      console.log(n1) // why n1 is null?
      n1.should.have.property('name', 'Discover Devices')
      done()
    })
  })
})
