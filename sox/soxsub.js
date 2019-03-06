var SoxConnection = require("SoxConnection");

function SoxSubscribeNode (config){
	if (
		!config.boshService || 
		!config.xmppServer || 
		!config.devices || 
		!Array.isArray(config.devices)
		){
    throw 'Not properly configured';
  }

  this.statusCallback = function(status){}

  this.statusCallback({msg: 'preparing the kitchen', indicator: 'yellow'})

  var conn = new SoxConnection(this.boshService, this.xmppServer);
  var devices = []

  config.devices.forEach(function(e){
  	devices.push(conn.bind(e))
  })

	var device = conn.bind(deviceName);

	conn.connect(function() {
	  console.log("@@@ connected");
	  var listenerId = conn.addListener(device, function(data) {
	    console.log("@@@@ data retrieved");

	    var deviceName = data.getDevice().getName();

	    console.log("--------- API1: list of TransducerValue");
	    var values = data.getTransducerValues();
	    var i = 0;

	    for (i = 0; i < values.length; i++) {
	      var v = values[i];
	      console.log("id=" + v.getTransducerId() + ", rawValue=" + v.getRawValue() + ", typedValue=" + v.getTypedValue());
	    }

	    console.log("--------- API2: get id => rawValue mapping object");
	    var id2rv = data.getRawValues();
	    var ids = Object.keys(id2rv);
	    for (i = 0; i < ids.length; i++) {
	      var tid = ids[i];
	      console.log("" + tid + " => raw=" + id2rv[tid]);
	    }

	    console.log("--------- API3: get id => typedValue mapping object");
	    var id2tv = data.getTypedValues();
	    for (i = 0; i < ids.length; i++) {
	      var tid = ids[i];
	      console.log("" + tid + " => typed=" + id2tv[tid]);
	    }
	  });
	  console.log("@@@ listener ID = " + listenerId);
	  conn.subscribe(device);
	});
}

SoxSubscribeNode.prototype.onClose = function() {
	// body...
}
SoxSubscribeNode.prototype.onStatusChanged = function(cb) {
	this.statusCallback = cb
}
module.exports = SoxSubscribeNode