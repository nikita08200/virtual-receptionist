import Janus from './janus';
import $ from 'jquery';

import video from '../images/video.png';
import bell from '../images/Group3.png';
import videooff from '../images/videooff.png';
import mic from '../images/mic.png';
import micoff from '../images/micoff.png';
import locationOfflineImage from '../images/location_offline.png';

var toastr = null;
var Spinner = null;
var server = null;
/* server = "https://" + "lt-dev.tk" + ":8089/janus"; */
server = process.env.REACT_APP_JANUS_URL;
var janusCall = null;
var janusRoom = null;
let videocall = null;
var textroom = null;
var opaqueId = "videocalltest-" + Janus.randomString(12);
var myusername = null;
var yourusername = null;
var doSimulcast = (getQueryStringValue("simulcast") === "yes" || getQueryStringValue("simulcast") === "true");
var doSimulcast2 = (getQueryStringValue("simulcast2") === "yes" || getQueryStringValue("simulcast2") === "true");
var sfutest = null;
var feeds = [];
var myid = null;
var mystream = null;
// We use this other ID just to map our subscriptions to us
var isHangUpFinish = false;
var mystreamCall = null;
var mypvtid = null;
var myroom = 1234;
var listOfUsers = [];
var participants = {};
var transactions = {};
var onOneToOneCall = false;
var holdHangup = false;
var peersOnHold = {};
var count = 0;

const locationDict = {
	brambleton: "Brambleton",
	bonsack: "Bonsack",
	north_roanoke: "North Roanoke",
	mcdowell: "McDowell",
	knotbreak: "Knotbreak",
};


export function startJanusServerRoom(userName) {
	// Initialize the library (all console debuggers enabled)
	Janus.init({
		debug: "all", callback: function () {
			// Create session
			janusRoom = new Janus(
				{
					server: server,
					iceServers: [{
						urls: process.env.REACT_APP_TURN_URL,
						credential: process.env.REACT_APP_TURN_PASS,
						username: process.env.REACT_APP_TURN_USER
					}, {
						urls: process.env.REACT_APP_STUN_URL
					}, {
						urls: "stun:stun.l.google.com:19302"
					}],
					success: function () {
						// Attach to VideoRoom plugin
						janusRoom.attach(
							{
								plugin: "janus.plugin.videoroom",
								opaqueId: opaqueId,
								success: function (pluginHandle) {
									sfutest = pluginHandle;
									Janus.log("Plugin attached! (" + sfutest.getPlugin() + ", id=" + sfutest.getId() + ")");
									Janus.log("  -- This is a publisher/manager");
									// Prepare the username registration
									registerUserOnRoom();
								},
								error: function (error) {
									Janus.error("  -- Error attaching plugin...", error);
								},
								consentDialog: function (on) {
									Janus.log("Consent dialog should be " + (on ? "on" : "off") + " now");
								},
								mediaState: function (medium, on) {
									Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
								},
								webrtcState: function (on) {
									Janus.log("Janus says our videoroom WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
								},
								onmessage: function (msg, jsep) {
									Janus.log(" ::: Got a message (publisher) :::");
									Janus.log(msg);
									var event = msg["videoroom"];
									Janus.log("Event: " + event);
									if (event != undefined && event != null) {
										if (event === "joined") {
											// Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
											myid = msg["id"];
											mypvtid = msg["private_id"];
											Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
											publishOwnFeed(false);
											// Any new feed to attach to?
											if (msg["publishers"] !== undefined && msg["publishers"] !== null) {
												const publishers = msg["publishers"];
												Janus.log("Got a list of available publishers/feeds:");
												Janus.log(publishers);

												publishers.forEach((publisher) => {
													Janus.log(`>> [${publisher.id}] ${publisher.display} (audio: ${publisher.audio}, video: ${publisher.video})`);
													newRemoteFeed(publisher.id, publisher.display, publisher.audio, publisher.video);
												});
											}
										} else if (event === "destroyed") {
											// The room has been destroyed
											Janus.warn("The room has been destroyed!");
										} else if (event === "event") {
											// Any new feed to attach to?
											if (msg["publishers"] !== undefined && msg["publishers"] !== null) {
												const publishers = msg["publishers"];

												Janus.log("Got a list of available publishers/feeds:");
												Janus.log(publishers);

												publishers.forEach((publisher) => {
													Janus.log(`>> [${publisher.id}] ${publisher.display} (audio: ${publisher.audio}, video: ${publisher.video})`);
													newRemoteFeed(publisher.id, publisher.display, publisher.audio, publisher.video);
												});
											} else if (msg["leaving"]) {
												// One of the publishers has gone away?												
												const leaving = msg["leaving"];
												Janus.log("Publisher left: " + leaving);
											} else if (msg["unpublished"]) {
												// One of the publishers has unpublished?																																		
												const unpublished = msg["unpublished"];
												const remoteFeed = feeds.find((feed) => feed && feed.rfid === unpublished);
												Janus.log("Publisher left: " + unpublished);
												console.log('unpublished', { participants });
												if (unpublished === 'ok') {
													sfutest.hangup();
													return;
												}
												if (remoteFeed) {
													const feedIdx = feeds.findIndex((feed) => feed.rfindex === remoteFeed.rfindex);

												    console.log('element unpublished', $(`#remotevideo${remoteFeed.rfindex}`));
													Janus.log("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
													if (remoteFeed.rfdisplay.includes("Server")) {
														$('#remotevideo' + remoteFeed.rfindex).parent().empty();
													} else {
														let parent = $('#remotevideo' + remoteFeed.rfindex).parent();
														parent.empty();
														parent.append(`<img src="${locationOfflineImage}" id="img3" class="card-media-image" style="width: 150px; height: 113px;">`);
													}
													feeds.splice(feedIdx, 1);
													remoteFeed.detach();
												}
											} else if (msg["error"] !== undefined && msg["error"] !== null) {
												if (msg["error_code"] === 426) {
													// This is a "no such room" error: give a more meaningful description
												} else {
													console.error(msg["error"]);
												}
											}
										}
									}
									if (jsep !== undefined && jsep !== null) {
										Janus.log("Handling SDP as well...");
										Janus.log(jsep);
										sfutest.handleRemoteJsep({ jsep: jsep });
										// Check if any of the media we wanted to publish has
										// been rejected (e.g., wrong or unsupported codec)
										var audio = msg["audio_codec"];
										if (mystream && mystream.getAudioTracks() && mystream.getAudioTracks().length > 0 && !audio) {
											// Audio has been rejected
											toastr.warning("Our audio stream has been rejected, viewers won't hear us");
										}
										var video = msg["video_codec"];
										if (mystream && mystream.getVideoTracks() && mystream.getVideoTracks().length > 0 && !video) {
											// Video has been rejected
											toastr.warning("Our video stream has been rejected, viewers won't see us");
											// Hide the webcam video											
										}
									}
								},
								onlocalstream: function (stream) {
									Janus.log(" ::: Got a local stream :::");
									mystream = stream;
									Janus.log(stream);
									$('#videoleft').append('<video class="rounded centered" id="myvideo" width=320 height=240 autoplay playsinline muted="muted"/>');
									try {
										Janus.attachMediaStream($('#myvideo').get(0), stream);
									}
									catch (err) { }
									if (sfutest.webrtcStuff.pc.iceConnectionState !== "completed" &&
										sfutest.webrtcStuff.pc.iceConnectionState !== "connected") {
										// No remote video yet
										$('#videoright').append('<video autoplay playsinline class="rounded centered" id="waitingvideo" width=320 height=240 />');
									}
									var videoTracks = stream.getVideoTracks();
									if (videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
										// No webcam
									}
								},
								onremotestream: function (stream) {
									// The publisher stream is sendonly, we don't expect anything here
								},
								oncleanup: function () {
									Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
									mystream = null;
								}
							});
						janusRoom.attach(
							{
								plugin: "janus.plugin.textroom",
								opaqueId: opaqueId,
								success: function (pluginHandle) {
									textroom = pluginHandle;
									window.textroom = textroom;
									Janus.log("Plugin attached! (" + textroom.getPlugin() + ", id=" + textroom.getId() + ")");
									// Setup the DataChannel
									var body = { "request": "setup" };
									Janus.log("Sending message (" + JSON.stringify(body) + ")");
									textroom.send({ "message": body });
								},
								error: function (error) {
									console.error("  -- Error attaching plugin...", error);
								},
								webrtcState: function (on) {
									Janus.log("Janus says our textroom WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
								},
								onmessage: function (msg, jsep) {
									Janus.log(" ::: Got a message :::");
									Janus.log(msg);
									if (msg["error"] !== undefined && msg["error"] !== null) {
										alert(msg["error"]);
									}
									if (jsep !== undefined && jsep !== null) {
										// Answer
										textroom.createAnswer(
											{
												jsep: jsep,
												media: { audio: false, video: false, data: true },	// We only use datachannels
												success: function (jsep) {
													Janus.log("Got SDP!");
													Janus.log(jsep);
													var body = { "request": "ack" };
													textroom.send({ "message": body, "jsep": jsep });
												},
												error: function (error) {
													Janus.error("WebRTC error:", error);
													alert("WebRTC error... " + JSON.stringify(error));
												}
											});
									}
								},
								ondataopen: function (data) {
									Janus.log("The DataChannel is available!");
									registerUsernameTextRoom(userName);
								},
								ondata: function (data) {
									Janus.log("We got data from the DataChannel! " + data);
									try {
										var json = JSON.parse(data);
									} catch (error) {}
									var transaction = json["transaction"];
									if (transactions[transaction]) {
										// Someone was waiting for this
										transactions[transaction](json);
										delete transactions[transaction];
										return;
									}
									var what = json["textroom"];
									if (what === "message") {
										// Incoming message: public or private?										
										//broadcasting current calls
										const splitText = json["text"].split("-");
									    var _yourusername = splitText[1];
										const displayname = locationDict[_yourusername];

										if (json["text"].includes("oncall")) {
											const callername = splitText[2] === myusername ? 'you' : splitText[2];

											var elem = $('[data-user-id="' + _yourusername + '"]').attr('id');
											var message = `On CALL with ${callername}`;

											if (elem == "videoremote1") {
												$('#overlay1').empty();
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append(`<label id="${_yourusername}"><strong>${displayname}</strong><br>${message}</strong></label>`);
											} else if (elem == "videoremote2") {
												$('#overlay2').empty();
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append(`<label id="${_yourusername}"><strong>${displayname}</strong><br>${message}</strong></label>`);
											} else if (elem == "videoremote3") {
												$('#overlay3').empty();
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append(`<label id="${_yourusername}"><strong>${displayname}</strong><br>${message}</strong></label>`);
											} else if (elem == "videoremote4") {
												$('#overlay4').empty();
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append(`<label id="${_yourusername}"><strong>${displayname}</strong><br>${message}</strong></label>`);
											} else if (elem == "videoremote5") {
												$('#overlay5').empty();
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append(`<label id="${_yourusername}"><strong>${displayname}</strong><br>${message}</strong></label>`);
											} else if (elem == "videoremote6") {
												$('#overlay6').empty();
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append(`<label id="${_yourusername}"><strong>${displayname}</strong><br>${message}</strong></label>`);
											} else if (elem == "videoremote7") {
												$('#overlay7').empty();
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append(`<label id="${_yourusername}"><strong>${displayname}</strong><br>${message}</strong></label>`);
											} else if (elem == "videoremote8") {
												$('#overlay8').empty();
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append(`<label id="${_yourusername}"><strong>${displayname}</strong><br>${message}</strong></label>`);
											} else if (elem == "videoremote9") {
												$('#overlay9').empty();
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append(`<label id="${_yourusername}"><strong>${displayname}</strong><br>${message}</strong></label>`);
											} else if (elem == "videoremote10") {
												$('#overlay10').empty();
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append(`<label id="${_yourusername}"><strong>${displayname}</strong><br>${message}</strong></label>`);
											}
										} else if(json["text"].includes("hangup")) {
											var elem = $('[data-user-id="' + _yourusername + '"]').attr('id');
											if (elem == "videoremote1") {
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append('<label id="' + _yourusername + '" ><strong>' + displayname + '</strong></label>');
											} else if (elem == "videoremote2") {
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append('<label id="' + _yourusername + '" ><strong>' + displayname + '</strong></label>');
											} else if (elem == "videoremote3") {
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append('<label id="' + _yourusername + '" ><strong>' + displayname + '</strong></label>');
											} else if (elem == "videoremote4") {
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append('<label id="' + _yourusername + '" ><strong>' + displayname + '</strong></label>');
											} else if (elem == "videoremote5") {
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append('<label id="' + _yourusername + '" ><strong>' + displayname + '</strong></label>');
											} else if (elem == "videoremote6") {
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append('<label id="' + _yourusername + '" ><strong>' + displayname + ' </strong></label>');
											} else if (elem == "videoremote7") {
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append('<label id="' + _yourusername + '" ><strong>' + displayname + '</strong></label>');
											} else if (elem == "videoremote8") {
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append('<label id="' + _yourusername + '" ><strong>' + displayname + '</strong></label>');
											} else if (elem == "videoremote9") {
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append('<label id="' + _yourusername + '" ><strong>' + displayname + '</strong></label>');
											} else if (elem == "videoremote10") {
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append('<label id="' + _yourusername + '" ><strong>' + displayname + '</strong></label>');
											}
										} else if(json["text"].includes("onhold")) {
											const callername = splitText[2] === myusername ? 'you' : splitText[2];

											var elem = $('[data-user-id="' + _yourusername + '"]').attr('id');
                                            var message = `On HOLD with ${callername}`;
											if (elem == "videoremote1") {
												$('#overlay1').empty();
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append(`<label id="${_yourusername}"><strong>${displayname}</strong><br>${message}</strong></label>`);
											} else if (elem == "videoremote2") {
												$('#overlay2').empty();
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append(`<label id="${_yourusername}"><strong>${displayname}</strong><br>${message}</strong></label>`);
											} else if (elem == "videoremote3") {
												$('#overlay3').empty();
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append(`<label id="${_yourusername}"><strong>${displayname}</strong><br>${message}</strong></label>`);
											} else if (elem == "videoremote4") {
												$('#overlay4').empty();
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append(`<label id="${_yourusername}"><strong>${displayname}</strong><br>${message}</strong></label>`);
											} else if (elem == "videoremote5") {
												$('#overlay5').empty();
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append(`<label id="${_yourusername}"><strong>${displayname}</strong><br>${message}</strong></label>`);
											} else if (elem == "videoremote6") {
												$('#overlay6').empty();
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append(`<label id="${_yourusername}"><strong>${displayname}</strong><br>${message}</strong></label>`);
											} else if (elem == "videoremote7") {
												$('#overlay7').empty();
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append(`<label id="${_yourusername}"><strong>${displayname}</strong><br>${message}</strong></label>`);
											} else if (elem == "videoremote8") {
												$('#overlay8').empty();
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append(`<label id="${_yourusername}"><strong>${displayname}</strong><br>${message}</strong></label>`);
											} else if (elem == "videoremote9") {
												$('#overlay9').empty();
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append(`<label id="${_yourusername}"><strong>${displayname}</strong><br>${message}</strong></label>`);
											} else if (elem == "videoremote10") {
												$('#overlay10').empty();
												$('#' + _yourusername).empty();
												$('#' + _yourusername).append(`<label id="${_yourusername}"><strong>${displayname}</strong><br>${message}</strong></label>`);
											}
											holdHangup = true;
										} else { // settings claiming icons
											var elem = $('[data-user-id="' + json["text"] + '"]').attr('id');
											if (elem == "videoremote1") {
												if (!$('#overlay1').children().last().is('img')) {
													$('#overlay1').append(`<img src="${bell}" align="right">`);
												}
											} else if (elem == "videoremote2") {
												if (!$('#overlay2').children().last().is('img')) {
													$('#overlay2').append(`<img src="${bell}" align="right">`);
												}
											} else if (elem == "videoremote3") {
												if (!$('#overlay3').children().last().is('img')) {
													$('#overlay3').append(`<img src="${bell}" align="right">`);
												}
											} else if (elem == "videoremote4") {
												if (!$('#overlay4').children().last().is('img')) {
													$('#overlay4').append(`<img src="${bell}" align="right">`);
												}
											} else if (elem == "videoremote5") {
												if (!$('#overlay5').children().last().is('img')) {
													$('#overlay5').append(`<img src="${bell}" align="right">`);
												}
											} else if (elem == "videoremote6") {
												if (!$('#overlay6').children().last().is('img')) {
													$('#overlay6').append(`<img src="${bell}" align="right">`);
												}
											} else if (elem == "videoremote7") {
												if (!$('#overlay7').children().last().is('img')) {
													$('#overlay7').append(`<img src="${bell}" align="right">`);
												}
											} else if (elem == "videoremote8") {
												if (!$('#overlay8').children().last().is('img')) {
													$('#overlay8').append(`<img src="${bell}" align="right">`);
												}
											} else if (elem == "videoremote9") {
												if (!$('#overlay9').children().last().is('img')) {
													$('#overlay9').append(`<img src="${bell}" align="right">`);
												}
											} else if (elem == "videoremote10") {
												if (!$('#overlay10').children().last().is('img')) {
													$('#overlay10').append(`<img src="${bell}" align="right">`);
												}
											}
										}
									} else if (what === "announcement") {
										// Room announcement
										var msg = json["text"];
										msg = msg.replace(new RegExp('<', 'g'), '&lt');
										msg = msg.replace(new RegExp('>', 'g'), '&gt');
										var dateString = getDateString(json["date"]);
									} else if (what === "join") {
										// Somebody joined
										var username = json["username"];
										var display = json["display"];
										var peersOnHoldLength = Object.keys(peersOnHold).length;
										participants[username] = display ? display : username;
										// notify new participant about on call status oncall/onhold
										if (!locationDict[display]) {
											if (onOneToOneCall) {
												doSendData(`oncall-${yourusername}-${myusername}`);
											}
											if (peersOnHoldLength > 0) {
												for (var i=0; i < peersOnHoldLength; i++) {
													if (!onOneToOneCall || yourusername !== Object.keys(peersOnHold)[i])
														doSendData(`onhold-${Object.keys(peersOnHold)[i]}-${myusername}`)
												}

											}
										}
									} else if (what === "leave") {
										// Somebody left
										var username = json["username"];
										var when = new Date();
										delete participants[username];
										var elem = $('[data-user-id="Server-'+ userName+ '"]').attr('id');											
										if (elem == "videoadmin1"){
											$('#videoadmin1').empty();
										} else if(elem == "videoadmin2"){
											$('#videoadmin2').empty();
										}else if(elem == "videoadmin3"){
											$('#videoadmin3').empty();
										}
									} else if (what === "kicked") {
										// Somebody was kicked
										var username = json["username"];
										var when = new Date();
										delete participants[username];
									} else if (what === "destroyed") {
										if (json["room"] !== myroom)
											return;
										// Room was destroyed, goodbye!
										Janus.warn("The room has been destroyed!");
									}
								},
								oncleanup: function (event) {
									console.log({ event });
									Janus.log(" ::: Got a cleanup notification :::");
								}
							});
						janusRoom.attach(
							{
								plugin: "janus.plugin.videocall",
								opaqueId: opaqueId,
								success: function (pluginHandle) {
									videocall = pluginHandle;
									Janus.log("Plugin attached! (" + videocall.getPlugin() + ", id=" + videocall.getId() + ")");
									// Prepare the username registration									
									registerUserForCall(userName);
								},
								error: function (error) {
									Janus.error("  -- Error attaching plugin...", error);
									console.error("  -- Error attaching plugin... " + error);
								},
								consentDialog: function (on) {
									Janus.log("Consent dialog should be " + (on ? "on" : "off") + " now");

								},
								mediaState: function (medium, on) {
									Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
								},
								webrtcState: function (on) {
									Janus.log("Janus says our videocall WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
								},
								onmessage: function (msg, jsep) {
									Janus.log(" ::: Got a message :::");
									Janus.log(msg);
									var result = msg["result"];
									if (result !== null && result !== undefined) {
										if (result["list"] !== undefined && result["list"] !== null) {
											var list = result["list"];
											Janus.log("Got a list of registered peers:");
											Janus.log(list);
											listOfUsers = list;
											document.dispatchEvent(new Event('newUserListEvent'));
											for (var mp in list) {
												Janus.log("  >> [" + list[mp] + "]");
											}
										} else if (result["event"] !== undefined && result["event"] !== null) {
											var event = result["event"];
											if (event === 'registered') {
												myusername = result["username"];
												Janus.log("Successfully registered as " + myusername + "!");
												$('#youok').removeClass('hide').show().html("Registered as '" + myusername + "'");
												// Get a list of available peers, just for fun
												videocall.send({ "message": { "request": "list" } });
												// TODO Enable buttons to call now
												$('#phone').removeClass('hide').show();
												$('#call').unbind('click').click(doCall);
												$('#peer').focus();
											} else if (event === 'calling') {
												Janus.log("Waiting for the peer to answer...");
												// TODO Any ringtone?1												
											} else if (event === 'incomingcall') {
												Janus.log("Incoming call from " + result["username"] + "!");
												yourusername = result["username"];
												var elem = $('[data-user-id="' + result["username"] + '"]').attr('id');											
											} else if (event === 'accepted') {
												var peer = result["username"];
												if (peer === null || peer === undefined) {
													Janus.log("Call started!");
												} else {
													Janus.log(peer + " accepted the call!");
													yourusername = peer;
													isHangUpFinish = false;
													$('#' + yourusername).empty();
													// $('#' + yourusername).append('<label value="' + yourusername + '"  id="' + yourusername + '" ><strong>' + yourusername + ' - ON CALL </strong></label>');
													doSendData(`oncall-${yourusername}-${myusername}`);
												}
												// Video call can start
												try {
													if (jsep) {
														videocall.handleRemoteJsep({jsep: jsep});
													}
												} catch (error) {
													console.log("error");
													console.log(error);
												}
											} else if (event === 'update') {
												// An 'update' event may be used to provide renegotiation attempts
												if (jsep) {
													if (jsep.type === "answer") {
														videocall.handleRemoteJsep({ jsep: jsep });
													} else {
														videocall.createAnswer(
															{
																jsep: jsep,
																media: { data: true },	// Let's negotiate data channels as well
																success: function (jsep) {
																	Janus.log("Got SDP!");
																	Janus.log(jsep);
																	var body = { "request": "set" };
																	videocall.send({ "message": body, "jsep": jsep });
																},
																error: function (error) {
																	Janus.error("WebRTC error:", error);
																	console.error("WebRTC error... " + JSON.stringify(error));
																}
															});
													}
												}
											} else if (event === 'hangup') {
												Janus.log("Call hang up by " + result["username"] + " (" + result["reason"] + ")!");
												// Reset status												
												// videocall.hangup();
												isHangUpFinish = true;
												if (!holdHangup) {
													$('#' + yourusername).empty();
													$('#' + yourusername).append('<label value="' + yourusername + '"  id="' + yourusername + '" ><strong>' + yourusername + '</strong></label>');
													try {
														if (peersOnHold[yourusername]) {
															delete peersOnHold[yourusername];
														}
													} catch (e) {}
												} else if (count++ === 2) {
													// hold hangup
													count = -1;
													// holdHangup = false;
													onOneToOneCall = false;
													peersOnHold[yourusername] = `onhold-${myusername}`;
												}
												count++;
											} else if (event === "simulcast") {
												// Is simulcast in place?
												var substream = result["substream"];
												var temporal = result["temporal"];
											}
										}
									} else {
										// FIXME Error?
										var error = msg["error"];
										if (error.indexOf("already taken") > 0) {
											console.log("already taken");
											// FIXME Use status codes...
										}
										// TODO Reset status
										// videocall.hangup();
									}
								},
								onlocalstream: function (stream) {
									Janus.log(" ::: Got a local stream :::");
									Janus.log(stream);
									console.log({ webrtcStuff: videocall.webrtcStuff });
									if (videocall.webrtcStuff.pc.iceConnectionState !== "completed" &&
										videocall.webrtcStuff.pc.iceConnectionState !== "connected") {
										if ($('.spinner').length === 0) {
											$('#videoright').append('<span class="spinner">Loading...</span>');
										}
									}
									var videoTracks = stream.getVideoTracks();
									if (videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
										// No webcam
									}
								},
								onremotestream: function (stream) {
									Janus.log(" ::: Got a remote stream :::");
									Janus.log(stream);
									mystreamCall = stream;
									var addButtons = false;
									if ($('#remotevideo').length === 0) {
										addButtons = true;
										$('#videoright').empty();
										$('#videoright').append('<video class="rounded centered hide" id="remotevideo" width=530 height=360 autoplay playsinline />');
									}
									try {
										Janus.attachMediaStream($('#remotevideo').get(0), stream);
									} catch (err) { console.error(err); }

									var videoTracks = stream.getVideoTracks();
									if (videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
										// No remote video
										$('#remotevideo').hide();
										if ($('#videoright .no-video-container').length === 0) {
											$('#videoright').append(
												'<div class="no-video-container">' +
												'<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
												'<span class="no-video-text">No remote video available</span>' +
												'</div>');
										}
									} else {
										$('#videoright .no-video-container').remove();
										$('#remotevideo').removeClass('hide').show();
									}
									$('#videoremote' + videocall.rfindex).append('<video autoplay playsinline class="rounded centered" id="waitingvideo' + videocall.rfindex + '" width=320 height=240 />');
									$('#videoremote' + videocall.rfindex).append('<video class="rounded centered relative hide" id="remotevideo' + videocall.rfindex + '" width="100%" height="100%" autoplay playsinline/>');
									$('#videoremote' + videocall.rfindex).append(
										'<span class="label label-primary hide" id="curres' + videocall.rfindex + '" style="position: absolute; bottom: 0px; left: 0px; margin: 15px;"></span>' +
										'<span class="label label-info hide" id="curbitrate' + videocall.rfindex + '" style="position: absolute; bottom: 0px; right: 0px; margin: 15px;"></span>');

									if (Janus.webRTCAdapter.browserDetails.browser === "chrome" || Janus.webRTCAdapter.browserDetails.browser === "firefox" ||
										Janus.webRTCAdapter.browserDetails.browser === "safari") {
									}
								},
								oncleanup: function (stream) {
									console.log({ stream });
									Janus.log(" ::: Got a cleanup notification :::");
									$('#remotevideo').remove();
								}
							});
					},
					error: function (error) {
						Janus.error(error);
					},
					destroyed: function () { }
				});
		}
	});
};

export function restartJanusServerRoom() {
	feeds.forEach((remoteFeed) => {
		const feedIdx = feeds.findIndex((feed) => feed.rfindex === remoteFeed.rfindex);
		if (!remoteFeed.rfdisplay.includes("Server")) {
			let parent = $('#remotevideo' + remoteFeed.rfindex).parent();
			parent.empty();
			parent.append(`<img src="${locationOfflineImage}" id="img3" class="card-media-image" style="width: 150px; height: 113px;">`);
		} else {
            $('#remotevideo' + remoteFeed.rfindex).parent().empty();
        }
        feeds.splice(feedIdx, 1);
        remoteFeed.detach();
        Janus.log(`Restart [${remoteFeed.rfid}] ${remoteFeed.rfdisplay}`);
        newRemoteFeed(remoteFeed.rfid, remoteFeed.rfdisplay, remoteFeed.audio, remoteFeed.video);
	});
	// location.reload();
};

export function registerUserForCall(_username) {
	if (!_username)
		return Error('Missing username');
	var username = _username.toLowerCase();
	var register = { "request": "register", "username": username };
	videocall.send({ "message": register });
}

export function stopMirrorVideo() {
	if (videocall.isVideoMuted()) {
		videocall.unmuteVideo();
		$("#myvideo").show();
		$("#videoimg").attr("src", video);
	} else {
		videocall.muteVideo();
		$("#myvideo").hide();
		$("#videoimg").attr("src", videooff);
	}
}

export function onMutedMirror() {
	if (videocall.isAudioMuted()) {
		$("#myvideo").removeAttr("muted");
		$("#micimg").attr("src", mic);
		videocall.unmuteAudio();
	} else {
		$("#myvideo").attr("muted", "muted");
		$("#micimg").attr("src", micoff);
		videocall.muteAudio();
	}
}

export function onHoldHangup() {
	if (!videocall.webrtcStuff.myStream || !videocall.webrtcStuff.remoteStream) {
		Janus.error('Missing media stream');
		return;
	}
	// Hangup a call
	var hangup = { "request": "hangup" };
	videocall.send({ "message": hangup });
	videocall.hangup();
	doSendData(`onhold-${yourusername}-${myusername}`);
}


function getListOfPeers(listCallback) {
	var list = { "request": "list" };
	videocall.send({ "message": list });
	if (listCallback) {
		document.addEventListener('newUserListEvent', function (e) {
			console.log('newUserListEvent received!', e);
			listCallback(listOfUsers);
		});
	} else {
		return listOfUsers
	}
}

function registerUserOnRoom() {
	var username = "Server" + "-" + Janus.randomString(12);
	var register = { "request": "join", "room": myroom, "ptype": "publisher", "display": username };
	myusername = username;
	sfutest.send({ "message": register });
}

export function doCall(_username) {
  if (yourusername && onOneToOneCall) {
	doHangup();
  }

  if (_username) {
	setTimeout(() => {
	  var username = _username.toLowerCase();	
	  try {
		videocall.createOffer({
		  // By default, it's sendrecv for audio and video...
		  // media: { video: true, audio: true, data: true },
		  success: function (jsep) {
			console.log('success', { jsep, username });
			var body = { "request": "call", "username": username };
			videocall.send({ "message": body, "jsep": jsep });
			onOneToOneCall = true;
		  },
		  error: function (error) {
			console.log("WebRTC error...", error);
		  }
		});		
	  } catch (error) {
		console.error('calling error', error);
	  }
	}, 1000);
  }
}



export function doHangup() {
	// Hangup a call
	var hangup = { "request": "hangup" };
	videocall.send({ "message": hangup });
	videocall.hangup();

    console.log(`hanging up with ${yourusername}`);
	if (yourusername){
		doSendData("hangup-" + yourusername);
		yourusername = null;
	}

	$('#videoright').empty();
	onOneToOneCall = false;
}

export function destroyJanusConnection() {
	console.log('Destroy Janus sessions/connections');
	try {
		if (janusCall)
			janusCall.destroy();
		if (janusRoom)
			janusRoom.destroy();
	} catch (e) {
		Janus.error(e);
	}
}

function publishOwnFeed(useAudio) {
	// Publish our stream	
	sfutest.createOffer(
		{
			// Add data:true here if you want to publish datachannels as well
			media: { audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: true },	// Publishers are sendonly
			// If you want to test simulcasting (Chrome and Firefox only), then
			// pass a ?simulcast=true when opening this demo page: it will turn
			// the following 'simulcast' property to pass to janus.js to true
			simulcast: doSimulcast,
			simulcast2: doSimulcast2,
			success: function (jsep) {
				Janus.log("Got publisher SDP!");
				Janus.log(jsep);
				var publish = { "request": "configure", "audio": useAudio, "video": true };
				// You can force a specific codec to use when publishing by using the
				// audiocodec and videocodec properties, for instance:
				// 		publish["audiocodec"] = "opus"
				// to force Opus as the audio codec to use, or:
				// 		publish["videocodec"] = "vp9"
				// to force VP9 as the videocodec to use. In both case, though, forcing
				// a codec will only work if: (1) the codec is actually in the SDP (and
				// so the browser supports it), and (2) the codec is in the list of
				// allowed codecs in a room. With respect to the point (2) above,
				// refer to the text in janus.plugin.videoroom.cfg for more details
				sfutest.send({ "message": publish, "jsep": jsep });
			},
			error: function (error) {
				Janus.error("WebRTC error:", error);
				if (useAudio) {
					publishOwnFeed(false);
				} else {
					alert("WebRTC error... " + JSON.stringify(error));
				}
			}
		});
}
// Helper to parse query string
function getQueryStringValue(name) {
	name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
	var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
		results = regex.exec();
	return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function newRemoteFeed(id, display, audio, video) {
	// A new feed has been published, create a new plugin handle and attach to it as a subscriber
	var remoteFeed = null;
	janusRoom.attach(
		{
			plugin: "janus.plugin.videoroom",
			opaqueId: opaqueId,
			success: function (pluginHandle) {
				remoteFeed = pluginHandle;
				remoteFeed.simulcastStarted = false;
				Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
				Janus.log("  -- This is a subscriber");
				// We wait for the plugin to send us an offer
				var subscribe = { "request": "join", "room": myroom, "ptype": "subscriber", "feed": id, "private_id": mypvtid };
				// In case you don't want to receive audio, video or data, even if the
				// publisher is sending them, set the 'offer_audio', 'offer_video' or
				// 'offer_data' properties to false (they're true by default), e.g.:
				// 		subscribe["offer_video"] = false;
				// For example, if the publisher is VP8 and this is Safari, let's avoid video
				if (Janus.webRTCAdapter.browserDetails.browser === "safari" &&
					(video === "vp9" || (video === "vp8" && !Janus.safariVp8))) {
					if (video)
						video = video.toUpperCase();
					subscribe["offer_video"] = false;
				}
				remoteFeed.videoCodec = video;
				remoteFeed.send({ "message": subscribe });
			},
			error: function (error) {
				Janus.error("  -- Error attaching plugin...", error);
				console.error("Error attaching plugin... " + error);
			},
			onmessage: function (msg, jsep) {
				Janus.log(" ::: Got a message (subscriber) :::");
				Janus.log(msg);
				var event = msg["videoroom"];
				Janus.log("Event: " + event);
				if (msg["error"] !== undefined && msg["error"] !== null) {
					console.error(msg["error"]);
				} else if (event != undefined && event != null) {
					if (event === "attached") {
						// Subscriber created and attached
					    const places = new Array(11).fill(null).map((n, i) => i + 1);
						const usedPlaces = feeds.map((f) => f.rfindex);

						remoteFeed.rfindex = places.find((p) => !usedPlaces.includes(p));
						remoteFeed.rfid = msg["id"];
						remoteFeed.rfdisplay = msg["display"];

						feeds.push(remoteFeed);
						Janus.log("Successfully attached to feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") in room " + msg["room"]);
					} else if (event === "event") {
						// Check if we got an event on a simulcast-related event from this publisher
						var substream = msg["substream"];
						var temporal = msg["temporal"];
						if ((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
							if (!remoteFeed.simulcastStarted) {
								remoteFeed.simulcastStarted = true;
								// Add some new buttons								
							}
							// We just received notice that there's been a switch, update the buttons

						}
					} else {
						// What has just happened?
					}
				}
				if (jsep !== undefined && jsep !== null) {
					Janus.log("Handling SDP as well...");
					Janus.log(jsep);
					// Answer and attach
					remoteFeed.createAnswer(
						{
							jsep: jsep,
							// Add data:true here if you want to subscribe to datachannels as well
							// (obviously only works if the publisher offered them in the first place)
							media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
							success: function (jsep) {
								Janus.log("Got SDP!");
								Janus.log(jsep);
								var body = { "request": "start", "room": myroom };
								remoteFeed.send({ "message": body, "jsep": jsep });
							},
							error: function (error) {
								Janus.error("WebRTC error:", error);
								console.error("WebRTC error... " + JSON.stringify(error));
							}
						});
				}
			},
			webrtcState: function (on) {
				Janus.log("Janus says this WebRTC PeerConnection (feed #" + remoteFeed.rfindex + ") is " + (on ? "up" : "down") + " now");
			},
			onlocalstream: function (stream) {
				// The subscriber stream is recvonly, we don't expect anything here
			},
			onremotestream: function (stream) {
				Janus.log("Remote feed #" + remoteFeed.rfindex);
			    console.log('Remote feed', { remoteFeed });
			    console.log('Remote feed', { stream });
				// alert("Remote feed #" + remoteFeed.rfindex);
				var addButtons = false;
				const displayname = locationDict[remoteFeed.rfdisplay];
				if ($('#remotevideo' + remoteFeed.rfindex).length === 0) {
					addButtons = true;
					// No remote video yet					
					if (remoteFeed.rfdisplay.includes("Server")) {
						if ($('#videoadmin1').is(':empty')) {
							// $('#videoadmin1').append('<video class="rounded centered" id="waitingvideo' + remoteFeed.rfindex + '"');
							$('#videoadmin1').append('<video class="rounded centered relative " id="remotevideo' + remoteFeed.rfindex + '" width="100%" height="100%" autoplay playsinline muted="muted"/>');
							$('#videoadmin1').attr("data-user-id", remoteFeed.rfdisplay);
							$('#videoadmin1').append('<input id="valvid1' + '" type="hidden" value="' + remoteFeed.rfid + '">');
						} else if ($('#videoadmin2').is(':empty')) {
							$('#videoadmin2').append('<video class="rounded centered relative " id="remotevideo' + remoteFeed.rfindex + '" width="100%" height="100%" autoplay playsinline muted="muted"/>');
							$('#videoadmin2').attr("data-user-id", remoteFeed.rfdisplay);
							$('#videoadmin2').append('<input id="valvid2' + '" type="hidden" value="' + remoteFeed.rfid + '">');
						} else if ($('#videoadmin3').is(':empty')) {
							$('#videoadmin3').append('<video class="rounded centered relative " id="remotevideo' + remoteFeed.rfindex + '" width="100%" height="100%" autoplay playsinline muted="muted"/>');
							$('#videoadmin3').attr("data-user-id", remoteFeed.rfdisplay);
							$('#videoadmin3').append('<input id="valvid3' + '" type="hidden" value="' + remoteFeed.rfid + '">');
						} else {
							alert(`Too many receptionists. We reach the receptionist limit, things might get unstable`);
						}
					} else {
					  if ($('#videoremote1').children().last().is('img')) {
						$('#videoremote1').empty();
						$('#videoremote1').append('<video class="rounded centered relative  content" id="remotevideo' + remoteFeed.rfindex + '" width="150" height="113" autoplay playsinline muted="muted"/>');
						$('#videoremote1').append('<div class="overlay" id="overlay1"></div>');
						$('#videoremote1').attr("data-user-id", remoteFeed.rfdisplay);
						$('#videoremote1').append(
						  '<label value="' + remoteFeed.rfdisplay + '"  id="' + remoteFeed.rfdisplay + '" ><strong>' + displayname + '</strong></label>' +
						  '<input id="valvid' + remoteFeed.rfindex + '" type="hidden" value="' + remoteFeed.rfid + '">');

					  } else if ($('#videoremote2').children().last().is('img')) {
						$('#videoremote2').empty();
						$('#videoremote2').append('<video class="rounded centered relative  content" id="remotevideo' + remoteFeed.rfindex + '" width="150" height="113" autoplay playsinline muted="muted"/>');
						$('#videoremote2').attr("data-user-id", remoteFeed.rfdisplay);
						$('#videoremote2').append('<div class="overlay" id="overlay2"></div>');
						$('#videoremote2').append(
						  '<label value="' + remoteFeed.rfdisplay + '" id="' + remoteFeed.rfdisplay + '"><strong>' + displayname + '</strong></label>' +
						  '<input id="valvid' + remoteFeed.rfindex + '" type="hidden" value="' + remoteFeed.rfid + '">');
					  } else if ($('#videoremote3').children().last().is('img')) {
						$('#videoremote3').empty();
						$('#videoremote3').append('<video class="rounded centered relative  content" id="remotevideo' + remoteFeed.rfindex + '" width="150" height="113" autoplay playsinline muted="muted"/>');
						$('#videoremote3').append('<div class="overlay" id="overlay3"></div>');
						$('#videoremote3').attr("data-user-id", remoteFeed.rfdisplay);
						$('#videoremote3').append(
						  '<label value="' + remoteFeed.rfdisplay + '" id="' + remoteFeed.rfdisplay + '"><strong>' + displayname + '</strong></label>' +
						  '<input id="valvid' + remoteFeed.rfindex + '" type="hidden" value="' + remoteFeed.rfid + '">');
					  } else if ($('#videoremote4').children().last().is('img')) {
						$('#videoremote4').empty();
						$('#videoremote4').append('<video class="rounded centered relative  content" id="remotevideo' + remoteFeed.rfindex + '" width="150" height="113" autoplay playsinline muted="muted"/>');
						$('#videoremote4').append('<div class="overlay" id="overlay4"></div>');
						$('#videoremote4').attr("data-user-id", remoteFeed.rfdisplay);
						$('#videoremote4').append(
						  '<label value="' + remoteFeed.rfdisplay + '" id="' + remoteFeed.rfdisplay + '"><strong>' + displayname + '</strong></label>' +
						  '<input id="valvid' + remoteFeed.rfindex + '" type="hidden" value="' + remoteFeed.rfid + '">');
					  } else if ($('#videoremote5').children().last().is('img')) {
						$('#videoremote5').empty();
						$('#videoremote5').append('<video class="rounded centered relative  content" id="remotevideo' + remoteFeed.rfindex + '" width="150" height="113" autoplay playsinline muted="muted"/>');
						$('#videoremote5').append('<div class="overlay" id="overlay5"></div>');
						$('#videoremote5').attr("data-user-id", remoteFeed.rfdisplay);
						$('#videoremote5').append(
						  '<label value="' + remoteFeed.rfdisplay + '" id="' + remoteFeed.rfdisplay + '"><strong>' + displayname + '</strong></label>' +
						  '<input id="valvid' + remoteFeed.rfindex + '" type="hidden" value="' + remoteFeed.rfid + '">');

					  } else if ($('#videoremote6').children().last().is('img')) {
						$('#videoremote6').empty();
						$('#videoremote6').append('<video class="rounded centered relative  content" id="remotevideo' + remoteFeed.rfindex + '" width="150" height="113" autoplay playsinline muted="muted"/>');
						$('#videoremote6').append('<div class="overlay" id="overlay6"></div>');
						$('#videoremote6').attr("data-user-id", remoteFeed.rfdisplay);
						$('#videoremote6').append(
						  '<label value="' + remoteFeed.rfdisplay + '" id="' + remoteFeed.rfdisplay + '"><strong>' + displayname + '</strong></label>' +
						  '<input id="valvid' + remoteFeed.rfindex + '" type="hidden" value="' + remoteFeed.rfid + '">');
					  }
					}
				}
				try {
					Janus.attachMediaStream($('#remotevideo' + remoteFeed.rfindex).get(0), stream);
				} catch (err) {
					console.log('ERROR attaching mediastream', err);
				}

				var videoTracks = stream.getVideoTracks();
				if (videoTracks === null || videoTracks.length === 0) {
					// No remote video	
					// $('#remotevideo' + remoteFeed.rfindex).hide();
					if ($('#videoremote' + remoteFeed.rfindex + ' .no-video-container').length === 0) {
						$('#videoremote' + remoteFeed.rfindex).empty();
						$('#videoremote' + remoteFeed.rfindex).append(`<img src="${locationOfflineImage}" id="img3" class="card-media-image" style="width: 150px; height: 113px;">`);
					}
				} else {
					// $('#videoremote' + remoteFeed.rfindex + ' .no-video-container').remove();
					// $('#remotevideo' + remoteFeed.rfindex).removeClass('hide').show();
				}
			},
			oncleanup: function () {
				Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
			}
		});
}


// TEXT ROOM FUNCTIONS
function registerUsernameTextRoom(username) {
	myid = randomString(12);
	var transaction = randomString(12);
	var register = {
		textroom: "join",
		transaction: transaction,
		room: myroom,
		username: myid,
		display: username
	};
	myusername = username;
	transactions[transaction] = function (response) {
		if (response["textroom"] === "error") {
			// Something went wrong
			if (response["error_code"] === 417) {
				// This is a "no such room" error: give a more meaningful description
				Janus.log(
					"<p>Apparently room <code>" + myroom + "</code> (the one this demo uses as a test room) " +
					"does not exist...</p><p>Do you have an updated <code>janus.plugin.textroom.jcfg</code> " +
					"configuration file? If not, make sure you copy the details of room <code>" + myroom + "</code> " +
					"from that sample in your current configuration file, then restart Janus and try again."
				);
			} else {
				console.error(response["error"]);
			}
			// $('#username').removeAttr('disabled').val("");
			// $('#register').removeAttr('disabled').click(registerUsernameTextRoom);
			return;
		}
		// Any participants already in?
		console.log("Participants:", response.participants);
	};
	textroom.data({
		text: JSON.stringify(register),
		error: function (reason) {
			$('#username').removeAttr('disabled').val("");
			$('#register').removeAttr('disabled').click(registerUsernameTextRoom);
		}
	});
}

export function getTextRoom() {
	return textroom;
}

function doSendData(_data) {
	const message = {
		textroom: "message",
		transaction: randomString(12),
		room: myroom,
		text: _data,
	};
	// Note: messages are always acknowledged by default. This means that you'll
	// always receive a confirmation back that the message has been received by the
	// server and forwarded to the recipients. If you do not want this to happen,
	// just add an ack:false property to the message above, and server won't send
	// you a response (meaning you just have to hope it succeeded).
	textroom.data({
		text: JSON.stringify(message),
		error: function (reason) { Janus.error(reason); },
		success: function () { Janus.log('Success!'); }
	});
}

function sendPrivateMsg(username) {
	var display = participants[username];
	var message = {
		textroom: "message",
		transaction: randomString(12),
		room: myroom,
		to: username,
		text: 'test 1234'
	};
	textroom.data({
		text: JSON.stringify(message),
		error: function (reason) { Janus.error(reason); },
		success: function () {
		}
	});
}

// Helper to format times
function getDateString(jsonDate) {
	var when = new Date();
	if (jsonDate) {
		when = new Date(Date.parse(jsonDate));
	}
	var dateString =
		("0" + when.getUTCHours()).slice(-2) + ":" +
		("0" + when.getUTCMinutes()).slice(-2) + ":" +
		("0" + when.getUTCSeconds()).slice(-2);
	return dateString;
}

// Just an helper to generate random usernames
function randomString(len, charSet) {
	charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	var randomString = '';
	for (var i = 0; i < len; i++) {
		var randomPoz = Math.floor(Math.random() * charSet.length);
		randomString += charSet.substring(randomPoz, randomPoz + 1);
	}
	return randomString;
}
