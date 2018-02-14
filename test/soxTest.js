
var SoxConnection = require("soxjs2").SoxConnection;

var soxConfig = {  // FIXME
    boshService: "http://sox.ht.sfc.keio.ac.jp:5280/http-bind/",
    jid: "guest@sox.ht.sfc.keio.ac.jp",
    password: "xxxx"
};

// *** user login
// var conn = new SoxConnection(soxConfig.boshService, soxConfig.jid, soxConfig.password);

// *** anonymous login (jid=null does not work!)
var conn = new SoxConnection(soxConfig.boshService, 'sox.ht.sfc.keio.ac.jp');

// var deviceName = "Barcelona_weather";
// var deviceName = "genova5";
// var deviceName = "Disney";
var deviceName = "fujisawaGeoTweets";
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