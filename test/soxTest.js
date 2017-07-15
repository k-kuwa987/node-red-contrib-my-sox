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

var boshService = "http://sox.ht.sfc.keio.ac.jp:5280/http-bind/";
var xmppServer = "sox.ht.sfc.keio.ac.jp";

var client = new SoxClient(boshService, xmppServer);
var soxEventListener = new SoxEventListener();

soxEventListener.connected = function(soxEvent) {
	console.log("[soxTest.js] Connected "+soxEvent.soxClient);
	status("Connected: "+soxEvent.soxClient);
	
	var device = new Device("24時間降水量-えびの", soxEvent.soxClient);//デバイス名に_dataや_metaはつけない

	/* クライアントに繋がったら、デバイスにサブスクライブする */
	if(!client.subscribeDevice(device)){
		/* サーバに繋がってない場合などで、要求を送信できなかった場合はfalseが返ってくる */
		status("Couldn't send subscription request: "+device);
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
	status("Subscribed: "+soxEvent.device);
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
	status("Meta data received: "+soxEvent.device);
};
soxEventListener.sensorDataReceived = function(soxEvent){
	/**
	 * SoXサーバからセンサデータを受信すると呼ばれる。
	 * 受信したデータはTransducerインスタンスにセットされ、そのTransducerがイベントオブジェクトとして渡される。
	 */
	status("Sensor data received: "+soxEvent.device);
};

client.setSoxEventListener(soxEventListener);
client.connect();

function status(message){
	console.log(message);
}