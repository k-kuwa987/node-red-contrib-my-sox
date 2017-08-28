"use strict";
// var SoxClient = require('../sox/lib/sox/SoxClient.js');
// var SoxEventListener = require('../sox/lib/sox/SoxEventListener.js')
// var Device = require('../sox/lib/sox/Device.js')
// var SensorData = require('../sox/lib/sox/SensorData.js');
// var Transducer = require('../sox/lib/sox/Transducer.js');

var soxLib = require('../sox/lib/soxLib.js');

var SoxClient = soxLib.SoxClient;
var SoxEventListener = soxLib.SoxEventListener;
var Device = soxLib.Device;
var SensorData = soxLib.SensorData;
var Transducer = soxLib.Transducer;

var DEFAULT_BOSH = "http://nictsox-lv2.ht.sfc.keio.ac.jp:5280/http-bind/";
var DEFAULT_XMPP = "nictsox-lv2.ht.sfc.keio.ac.jp";

var boshService = DEFAULT_BOSH;
var xmppServer = DEFAULT_XMPP;

var client = new SoxClient(boshService, xmppServer);

var soxEventListener = new SoxEventListener();
soxEventListener.connected = function(soxEvent) {
	console.log("[main.js] Connected "+soxEvent.soxClient);
	status("Connected: "+soxEvent.soxClient);
	
	var deviceNames = "carsensor_replay_010,carsensor_replay_011,carsensor_replay_012,carsensor_replay_013,carsensor_replay_014,carsensor_replay_015,carsensor_replay_016,carsensor_replay_017,carsensor_replay_018,carsensor_replay_019,carsensor_replay_020,carsensor_replay_021,carsensor_replay_022,carsensor_replay_023,carsensor_replay_024,carsensor_replay_025,carsensor_replay_026,carsensor_replay_027,carsensor_replay_028,carsensor_replay_029,carsensor_replay_030,carsensor_replay_031,carsensor_replay_032,carsensor_replay_033,carsensor_replay_034,carsensor_replay_035,carsensor_replay_036,carsensor_replay_037,carsensor_replay_038,carsensor_replay_039,carsensor_replay_040,carsensor_replay_041,carsensor_replay_042,carsensor_replay_043,carsensor_replay_044,carsensor_replay_045,carsensor_replay_046,carsensor_replay_047,carsensor_replay_048,carsensor_replay_049,carsensor_replay_050,carsensor_replay_051,carsensor_replay_052,carsensor_replay_053,carsensor_replay_054,carsensor_replay_055,carsensor_replay_056,carsensor_replay_057,carsensor_replay_058,carsensor_replay_059,carsensor_replay_060,carsensor_replay_061,carsensor_replay_062,carsensor_replay_063,carsensor_replay_064,carsensor_replay_065,carsensor_replay_066,carsensor_replay_067,carsensor_replay_068,carsensor_replay_069,carsensor_replay_070,carsensor_replay_071,carsensor_replay_072,carsensor_replay_073,carsensor_replay_074,carsensor_replay_075,carsensor_replay_076,carsensor_replay_077,carsensor_replay_078,carsensor_replay_079,carsensor_replay_080,carsensor_replay_081,carsensor_replay_082,carsensor_replay_083,carsensor_replay_084,carsensor_replay_085".split(',');
	for (var i = 0; i < deviceNames.length; i++){
		client.subscribeDevice(new Device(deviceNames[i]))
	}
};

soxEventListener.connectionFailed = function(soxEvent) {
	status("Connection Failed: "+soxEvent.soxClient);
};

soxEventListener.resolved = function(soxEvent) {
	status("Device Resolved: "+soxEvent.soxClient);
};

soxEventListener.resolveFailed = function(soxEvent){
	/* couldn't get device information from the server */
	status("Resolve Failed: "+soxEvent.device+" code="+soxEvent.errorCode+" type="+soxEvent.errorType);
};

soxEventListener.subscribed = function(soxEvent){
	// status("Subscribed: "+soxEvent.device);
};
soxEventListener.subscriptionFailed = function(soxEvent){
	/* デバイスが存在しないなどのときはここに来る */
	status("Subscription Failed: "+soxEvent.device);
};
soxEventListener.metaDataReceived = function(soxEvent){
	/**
	 * SoXサーバからデバイスのメタ情報を受信すると呼ばれる。
	 * 受信したメタ情報に基づいて、Device内にTransducerインスタンスが生成されている。
	 */
	status("Meta data received: "+soxEvent);
};
soxEventListener.sensorDataReceived = function(soxEvent){
	/**
	 * SoXサーバからセンサデータを受信すると呼ばれる。
	 * 受信したデータはTransducerインスタンスにセットされ、そのTransducerがイベントオブジェクトとして渡される。
	 */
	status("Sensor data received: "+soxEvent.device.name);
};

client.setSoxEventListener(soxEventListener);
client.connect();

function status(message){
	console.log(message);
}