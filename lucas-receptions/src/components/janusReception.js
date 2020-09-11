import Janus from './janus';
import $ from 'jquery';
var toastr = null;
var Spinner = null;
var server = null;
/* server = "https://" + "lt-dev.tk" + ":8089/janus"; */
server = process.env.REACT_APP_JANUS_URL;
var janusCall = null;
var janusRoom = null;
var janusTextRoom = null;
var sfutest = null;
var textroom = null;
var myroom = 1234;
var videocall = null;
var opaqueId = "videocalltest-"+Janus.randomString(12);
var mypvtid = null;
var bitrateTimer = null;
var spinner = null;
var audioenabled = false;
var videoenabled = false;
var myusername = null;
var yourusername = null;
var feeds = [];
var myid = null;
var mystream = null;
var doSimulcast = (getQueryStringValue("simulcast") === "yes" || getQueryStringValue("simulcast") === "true");
var doSimulcast2 = (getQueryStringValue("simulcast2") === "yes" || getQueryStringValue("simulcast2") === "true");
var simulcastStarted = false;
var listOfUsers = [];
var participants = {};
var transactions = {};
var backupStream = null;

export function startJanusServerRoom(receptionID){
	var IS_IPAD = isIpadOS();
	var IS_IPHONE = isIOS();
	// Initialize the library (all console debuggers enabled)
	Janus.init({debug: "all", callback: function() {			
		// Make sure the browser supports WebRTC
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
				success: function() {
					// Attach to VideoRoom plugin
					janusRoom.attach(
						{
							plugin: "janus.plugin.videoroom",
							opaqueId: opaqueId,
							success: function(pluginHandle) {
								sfutest = pluginHandle;
								Janus.log("Plugin attached! (" + sfutest.getPlugin() + ", id=" + sfutest.getId() + ")");
								Janus.log("  -- This is a publisher/manager");
								// Prepare the username registration								
								var reg = Janus.randomString(12);
								registerUserOnRoom(receptionID);
							},
							error: function(error) {
								Janus.error("  -- Error attaching plugin...", error);								
							},
							consentDialog: function(on) {
								Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
							},
							mediaState: function(medium, on) {
								Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
							},
							webrtcState: function(on) {
								Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
							},
							onmessage: function(msg, jsep) {								
								Janus.debug(" ::: Got a message (publisher) :::");
								Janus.debug(msg);
								var event = msg["videoroom"];
								Janus.debug("Event: " + event);
								if(event != undefined && event != null) {
									if(event === "joined") {
										// Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
										myid = msg["id"];
										Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
										// let's not publish audio and video so it is not requested again for 1 to 1
										publishOwnFeed(true);
										// Any new feed to attach to?
										if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
											var list = msg["publishers"];
											Janus.debug("Got a list of available publishers/feeds:");
											Janus.debug(list);
											for(var f in list) {
												var id = list[f]["id"];
												var display = list[f]["display"];
												var audio = list[f]["audio_codec"];
												var video = list[f]["video_codec"];
												Janus.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");												
											}
										}
									} else if(event === "destroyed") {
										// The room has been destroyed
										Janus.warn("The room has been destroyed!");
										console.error("The room has been destroyed");
									} else if(event === "event") {
										// Any new feed to attach to?
										if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
											// We don't need to know about publishers in the room from the reception/location page
											// var list = msg["publishers"];
										} else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
											// One of the publishers has gone away?
										} else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
											// One of the publishers has unpublished?
                                            if (msg["unpublished"] === 'ok') {
                                                sfutest.hangup();
                                                return;
                                            }
										} else if(msg["error"] !== undefined && msg["error"] !== null) {
											if(msg["error_code"] === 426) {
												// This is a "no such room" error: give a more meaningful description
											} else {
												alert(msg["error"]);
											}
										}
									}
								}
								if(jsep !== undefined && jsep !== null) {
									Janus.debug("Got room event. Handling SDP as well...");
									Janus.debug(jsep);
									sfutest.handleRemoteJsep({jsep: jsep});
									// Check if any of the media we wanted to publish has
									// been rejected (e.g., wrong or unsupported codec)
									var audio = msg["audio_codec"];
									if(mystream && mystream.getAudioTracks() && mystream.getAudioTracks().length > 0 && !audio) {
										// Audio has been rejected
										toastr.warning("Our audio stream has been rejected, viewers won't hear us");
									}
									var video = msg["video_codec"];
									if(mystream && mystream.getVideoTracks() && mystream.getVideoTracks().length > 0 && !video) {
										// Video has been rejected
										toastr.warning("Our video stream has been rejected, viewers won't see us");
										// Hide the webcam video
										$('#myvideo').hide();
										$('#videolocal').append(
											'<div class="no-video-container">' +
												'<i class="fa fa-video-camera fa-5 no-video-icon" style="height: 100%;"></i>' +
												'<span class="no-video-text" style="font-size: 16px;">Video rejected, no webcam</span>' +
											'</div>');
									}
								}
							},
							onlocalstream: function(stream) {
								Janus.debug("::: Got a local stream :::");
								if (!backupStream) {
									backupStream = new MediaStream(stream.getTracks());
								}
							},
							// onremotestream: function(stream) {
							// 	// The publisher stream is sendonly, we don't expect anything here
							// },
							oncleanup: function() {
								Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
								mystream = null;
								backupStream = null;
							}
						});
					janusRoom.attach(
						{
							plugin: "janus.plugin.textroom",
							opaqueId: opaqueId,
							success: function(pluginHandle) {
								textroom = pluginHandle;
								window.textroom = textroom;
								Janus.log("Plugin attached! (" + textroom.getPlugin() + ", id=" + textroom.getId() + ")");
								// Setup the DataChannel
								var body = { "request": "setup" };
								Janus.debug("Sending message (" + JSON.stringify(body) + ")");
								textroom.send({"message": body});
							},
							error: function(error) {
								console.error("  -- Error attaching plugin...", error);
							},
							webrtcState: function(on) {
								Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
							},
							onmessage: function(msg, jsep) {
								Janus.debug(" ::: Got a message :::");
								Janus.debug(msg);
								if(msg["error"] !== undefined && msg["error"] !== null) {
									console.log(msg["error"]);
								}
								if(jsep !== undefined && jsep !== null) {
									// Answer
									textroom.createAnswer(
										{
											jsep: jsep,
											media: { audio: false, video: false, data: true },	// We only use datachannels
											success: function(jsep) {
												Janus.debug("Got SDP!");
												Janus.debug(jsep);
												var body = { "request": "ack" };
												textroom.send({"message": body, "jsep": jsep});
											},
											error: function(error) {
												Janus.error("WebRTC error:", error);
												alert("WebRTC error... " + JSON.stringify(error));
											}
										});
								}
							},
							ondataopen: function(data) {
								Janus.log("The DataChannel is available!");
								registerUsernameTextRoom(receptionID);
							},
							ondata: function(data) {
								Janus.log("We got data from the DataChannel! " + data);
								var json = JSON.parse(data);
								var transaction = json["transaction"];
								if(transactions[transaction]) {
									// Someone was waiting for this
									transactions[transaction](json);
									delete transactions[transaction];
									return;
								}
								var what = json["textroom"];
								if(what === "message") {
									// Incoming message: public or private?
									var msg = json["text"];
									var yourusername = msg;
									if(msg.includes("pause")){
										yourusername = yourusername.split("-")[1];
										if(yourusername===receptionID){
											$('#remotevideo').hide();
											$('#videoright').append(
												'<video class="rounded centered hide position-relative" id="remotevideo123" style="width: 100%; max-height: 80vh;" autoplay playsinline/>'
											);
										}
									}else if(msg.includes("play")){
										yourusername = yourusername.split("-")[1];
										if(yourusername===receptionID){
											$('#remotevideo').show();
											$('#remotevideo123').remove();
										}
									}
								} else if(what === "announcement") {
									// Room announcement
									var msg = json["text"];
									msg = msg.replace(new RegExp('<', 'g'), '&lt');
									msg = msg.replace(new RegExp('>', 'g'), '&gt');
								} else if(what === "join") {
									// Somebody joined
									var username = json["username"];
									var display = json["display"];
									console.log({ participants });
									participants[username] = display ? display : username;
								} else if(what === "leave") {
									// Somebody left
									var username = json["username"];
									var when = new Date();
									delete participants[username];
								} else if(what === "kicked") {
									// Somebody was kicked
									var username = json["username"];
									var when = new Date();
									delete participants[username];
								} else if(what === "destroyed") {
									if(json["room"] !== myroom)
										return;
									// Room was destroyed, goodbye!
									Janus.warn("The room has been destroyed!");
								}
							},
							oncleanup: function() {
								Janus.log(" ::: Got a cleanup notification :::");
							}
						});
					janusRoom.attach(
						{
							plugin: "janus.plugin.videocall",
							opaqueId: opaqueId,
							success: function(pluginHandle) {
								videocall = pluginHandle;
								Janus.log("Plugin attached! (" + videocall.getPlugin() + ", id=" + videocall.getId() + ")");
								// Prepare the username registration
								registerUserForCall(receptionID);
								$('#subnav11').hide();
								$('#subnav12').hide();
							},
							error: function(error) {
								Janus.error("  -- Error attaching plugin...", error);
							},
							consentDialog: function(on) {
								Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");

							},
							mediaState: function(medium, on) {
								Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
							},
							webrtcState: function(on) {
								Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
							},
							onmessage: function(msg, jsep) {
								Janus.debug(" ::: Got a message :::");
								Janus.debug(msg);
								var result = msg["result"];
								if(result !== null && result !== undefined) {
									if(result["list"] !== undefined && result["list"] !== null) {
										var list = result["list"];
										Janus.debug("Got a list of registered peers:");
										Janus.debug(list);
										listOfUsers = list;
										document.dispatchEvent(new Event('newUserListEvent'));
										for(var mp in list) {
											Janus.debug("  >> [" + list[mp] + "]");
										}
									} else if(result["event"] !== undefined && result["event"] !== null) {
										var event = result["event"];
										if(event === 'registered') {
											myusername = result["username"];
											Janus.log("Successfully registered as " + myusername + "!");
											$('#youok').removeClass('hide').show().html("Registered as '" + myusername + "'");
											// Get a list of available peers, just for fun
											listOfUsers = getListOfPeers();
											// TODO Enable buttons to call now
										} else if(event === 'calling') {
											Janus.log("Waiting for the peer to answer...");
											// TODO Any ringtone?
										} else if(event === 'incomingcall') {
											Janus.log("Incoming call from " + result["username"] + "!");
											yourusername = result["username"];
											// Notify user
											// bootbox.hideAll();
											var incoming = null;
											// here we pass the same video/audio stream we requested before without user request
											// we use that for user experience and due to a
											// Safari iOS Bug: https://bugs.webkit.org/show_bug.cgi?id=179363
											if (backupStream) {
												videocall.createAnswer(
													{
														jsep: jsep,
														stream: backupStream,
														// No media provided: by default, it's sendrecv for audio and video
														// media: { data: true },	// Let's negotiate data channels as well
														// If you want to test simulcasting (Chrome and Firefox only), then
														// pass a ?simulcast=true when opening this demo page: it will turn
														// the following 'simulcast' property to pass to janus.js to true
														simulcast: doSimulcast,
														success: function (jsep) {
															Janus.debug("Got SDP!");
															var body = {"request": "accept"};
															videocall.send({"message": body, "jsep": jsep});
														},
														error: function (error) {
															Janus.error("WebRTC error:", error);
															alert(JSON.stringify(error));
															// bootbox.alert("WebRTC error... " + JSON.stringify(error));
														}
													});
											}
										} else if(event === 'accepted') {
											// bootbox.hideAll();
											var peer = result["username"];
											if(peer === null || peer === undefined) {
												Janus.log("Call started with!", yourusername);
												$('#callername').text(`on call with ${yourusername}`);
											} else {
												Janus.log(peer + " accepted the call!");
												yourusername = peer;
											}
											// Video call can start
											if(jsep) {
												videocall.handleRemoteJsep({jsep: jsep});
											}

										} else if(event === 'update') {
											// An 'update' event may be used to provide renegotiation attempts
											if(jsep) {
												if(jsep.type === "answer") {
													videocall.handleRemoteJsep({jsep: jsep});
												} else {
													videocall.createAnswer(
														{
															jsep: jsep,
															// media: { data: true },	// Let's negotiate data channels as well
															success: function(jsep) {
																Janus.debug("Got SDP!");
																Janus.debug(jsep);
																var body = { "request": "set" };
																videocall.send({"message": body, "jsep": jsep});
															},
															error: function(error) {
																Janus.error("WebRTC error:", error);
																// bootbox.alert("WebRTC error... " + JSON.stringify(error));
															}
														});
												}
											}
										} else if(event === 'hangup') {
											Janus.log("Call hang up by " + result["username"] + " (" + result["reason"] + ")!");
											// Reset status
											// videocall.hangup();

											$('#callername').text('');
											$('.modal').show();
											$('.modal-backdrop').show();
											// destroyJanusConnections();
										} else if(event === "simulcast") {
											// Is simulcast in place?
											var substream = result["substream"];
											var temporal = result["temporal"];
											if((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
												if(!simulcastStarted) {
													simulcastStarted = true;
													// addSimulcastButtons(result["videocodec"] === "vp8" || result["videocodec"] === "h264");
												}
												// We just received notice that there's been a switch, update the buttons
												// updateSimulcastButtons(substream, temporal);
											}
										}
									}
								} else {
									// FIXME Error?
									var error = msg["error"];
									if(error.indexOf("already taken") > 0) {
										console.error("already taken username:" + JSON.stringify(error));
										// registerUserForCall("ELMONT");
									}
									// TODO Reset status
									// videocall.hangup();
								}
							},
							onlocalstream: function(stream) {
								Janus.debug(" ::: Got a local stream :::");
								Janus.debug(stream);
								console.log({ webrtcStuff: videocall.webrtcStuff });
								if(videocall.webrtcStuff.pc.iceConnectionState !== "completed" &&
										videocall.webrtcStuff.pc.iceConnectionState !== "connected") {

								}
								var videoTracks = stream.getVideoTracks();
								if(videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
									// No webcam
									if($('#videoleft .no-video-container').length === 0) {
										$('#videoleft').append(
											'<div class="no-video-container">' +
												'<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
												'<span class="no-video-text">No webcam available</span>' +
											'</div>');
									}
								} else {
									$('#videoleft .no-video-container').remove();
									$('#myvideo').removeClass('hide').show();
								}
							},
							onremotestream: function(stream) {
								Janus.debug(" ::: Got a remote stream :::");
								Janus.debug(stream);
								var addButtons = false;
								if($('#remotevideo').length === 0) {
									addButtons = true;
									$('#videoright').append('<video class="rounded centered hide position-relative" id="remotevideo" style="width: 100%; max-height: 80vh;" autoplay playsinline/>');
									// Show the video, hide the spinner and show the resolution when we get a playing event
									$('.modal').hide();
									$('.modal-backdrop').hide();
									$("#remotevideo").bind("playing", function () {
										$('#waitingvideo').remove();
										if(this.videoWidth)
											$('#remotevideo').removeClass('hide').show();
										if(spinner !== null && spinner !== undefined)
											spinner.stop();
										spinner = null;
										var width = this.videoWidth;
										var height = this.videoHeight;
										$('#curres').removeClass('hide').text(width+'x'+height).show();
									});
									$('#callee').removeClass('hide').html(yourusername).show();
								}
								try {
									Janus.attachMediaStream($('#remotevideo').get(0), stream);
								} catch (err) {
									console.error(err);
								}
								var videoTracks = stream.getVideoTracks();
								if(videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
									// No remote video
									if($('#videoright .no-video-container').length === 0) {
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
								if(!addButtons)
									return;
								// Enable audio/video buttons and bitrate limiter
								audioenabled = true;
								videoenabled = true;
								$('#toggleaudio').html("Disable audio").removeClass("btn-success").addClass("btn-danger")
										.unbind('click').removeAttr('disabled').click(
									function() {
										audioenabled = !audioenabled;
										if(audioenabled)
											$('#toggleaudio').html("Disable audio").removeClass("btn-success").addClass("btn-danger");
										else
											$('#toggleaudio').html("Enable audio").removeClass("btn-danger").addClass("btn-success");
										videocall.send({"message": { "request": "set", "audio": audioenabled }});
									});
								$('#togglevideo').html("Disable video").removeClass("btn-success").addClass("btn-danger")
										.unbind('click').removeAttr('disabled').click(
									function() {
										videoenabled = !videoenabled;
										if(videoenabled)
											$('#togglevideo').html("Disable video").removeClass("btn-success").addClass("btn-danger");
										else
											$('#togglevideo').html("Enable video").removeClass("btn-danger").addClass("btn-success");
										videocall.send({"message": { "request": "set", "video": videoenabled }});
									});
								$('#toggleaudio').parent().removeClass('hide').show();
								$('#bitrateset').html("Bandwidth");
								$('#bitrate a').unbind('click').removeAttr('disabled').click(function() {
									var id = $(this).attr("id");
									var bitrate = parseInt(id)*1000;
									if(bitrate === 0) {
										Janus.log("Not limiting bandwidth via REMB");
									} else {
										Janus.log("Capping bandwidth to " + bitrate + " via REMB");
									}
									$('#bitrateset').html($(this).html()).parent().removeClass('open');
									videocall.send({"message": { "request": "set", "bitrate": bitrate }});
									return false;
								});
								if(Janus.webRTCAdapter.browserDetails.browser === "chrome" || Janus.webRTCAdapter.browserDetails.browser === "firefox" ||
										Janus.webRTCAdapter.browserDetails.browser === "safari") {
									$('#curbitrate').removeClass('hide').show();
									bitrateTimer = setInterval(function() {
										// Display updated bitrate, if supported
										var bitrate = videocall.getBitrate();
										$('#curbitrate').text(bitrate);
										// Check if the resolution changed too
										// var width = $("#remotevideo").get(0).videoWidth;
										// var height = $("#remotevideo").get(0).videoHeight;
										// if(width > 0 && height > 0)
										// 	$('#curres').removeClass('hide').text(width+'x'+height).show();
									}, 1000);
								}
							},
							oncleanup: function() {
								Janus.log(" ::: Got a cleanup notification :::");
								$('#myvideo').remove();
								$('#remotevideo').remove();
								$('.no-video-container').remove();
								yourusername = null;

							}
						});
				},
				error: function(error) {
					Janus.error(error);
					alert(error);

				},
				destroyed: function() {
				  console.log('destroyed');
				}
			});
	}});
};

function registerUserForCall(_username) {
	if (!_username)
		return Error('Missing username');
	var username = _username.toLowerCase();
	var register = { "request": "register", "username": username };
	videocall.send({"message": register});
}

export function getListOfPeers(listCallback) {
    var list = { "request": "list" };
    videocall.send({"message": list});
    if (listCallback) {
		document.addEventListener('newUserListEvent', function(e){
			console.log('newUserListEvent received!', e);
			listCallback(listOfUsers);
		});
	} else {
    	return listOfUsers
	}
}


function registerUserOnRoom(_username) {
	var username = _username;
	var register = { "request": "join", "room": myroom, "ptype": "publisher", "display": username };
	myusername = username;
	sfutest.send({ "message": register });
}

export function doCall(_username) {
	if (!_username)
		console.error('Missing username');
	var username = _username.toLowerCase();
	videocall.createOffer(
		{
			// By default, it's sendrecv for audio and video...
			// media: { audioRecv: false, videoRecv: false, audioSend: true, videoSend: true },
			// If you want to test simulcasting (Chrome and Firefox only), then
			// pass a ?simulcast=true when opening this demo page: it will turn
			// the following 'simulcast' property to pass to janus.js to true
			simulcast: doSimulcast,
			success: function(jsep) {
				Janus.debug("Got SDP!");
				Janus.debug(jsep);
				var body = { "request": "call", "username": username };
				videocall.send({"message": body, "jsep": jsep});
			},
			error: function(error) {
				Janus.error("WebRTC error...", error);
				console.error("WebRTC error... " + error);
			}
		});
}

function isIOS() {
	if (/iPad|iPhone|iPod/.test(navigator.platform)) {
	  return true;
	} else {
	  return navigator.maxTouchPoints &&
		navigator.maxTouchPoints > 2 &&
		/MacIntel/.test(navigator.platform);
	}
  }
  
  function isIpadOS() {
	return navigator.maxTouchPoints &&
	  navigator.maxTouchPoints > 2 &&
	  /MacIntel/.test(navigator.platform);
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
			success: function(jsep) {
				Janus.debug("Got publisher SDP!");
				Janus.debug(jsep);
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
				sfutest.send({"message": publish, "jsep": jsep});
			},
			error: function(error) {
				Janus.error("WebRTC error:", error);
				// if (useAudio) {
				// 	 publishOwnFeed(false);
				// }
			}
		});
}

//Replace local video feed
function replaceOwnFeed(track) {
	sfutest.createOffer(
		{
			media: {
				audio: false,
				video: {
					deviceId: track.id
				},
				replaceVideo: true
			},
			// stream: stream,
			success: function(jsep) {
				Janus.debug(jsep);
				sfutest.send({message: {audio: false, video: true}, "jsep": jsep});
			},
			error: function(error) {
				Janus.error("WebRTC error... " + JSON.stringify(error));
			}
		});
}

function doHangup() {
	// Hangup a call	
	var hangup = { "request": "hangup" };
	videocall.send({"message": hangup});
	videocall.hangup();
	yourusername = null;
}

export function destroyJanusConnections() {
	console.log('Destroy Janus sessions/connections');
	try {		
		janusRoom.destroy();
	} catch (e) {
		Janus.error(e);
	}
}

// Helper to parse query string
function getQueryStringValue(name) {
	name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
	var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
		results = regex.exec();
	return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

// TEXT ROOM
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
	transactions[transaction] = function(response) {
		if(response["textroom"] === "error") {
			// Something went wrong
			if(response["error_code"] === 417) {
				// This is a "no such room" error: give a more meaningful description
				Janus.log(
					"<p>Apparently room <code>" + myroom + "</code> (the one this demo uses as a test room) " +
					"does not exist...</p><p>Do you have an updated <code>janus.plugin.textroom.jcfg</code> " +
					"configuration file? If not, make sure you copy the details of room <code>" + myroom + "</code> " +
					"from that sample in your current configuration file, then restart Janus and try again."
				);
			} else {
				// bootbox.alert(response["error"]);
			}
			return;
		}
		// We're in
		// Any participants already in?
		const isBusy = !!response.participants.find((p) => p.display === username);
		if (isBusy) {
			window.location = '/';
		}

		console.log("Participants:", response.participants);
	};
	textroom.data({
		text: JSON.stringify(register),
		error: function(reason) {
			// bootbox.alert(reason);
			$('#username').removeAttr('disabled').val("");
			$('#register').removeAttr('disabled').click(registerUsernameTextRoom);
		}
	});
}

export function getTextRoom() {
	return textroom;
}

export function doSendClaim(data) {
	// var data = $('#datasend').val();
	if(!data) {
		console.error('Missing data to send');
		return;
	}
	var message = {
		textroom: "message",
		transaction: randomString(12),
		room: myroom,
		text: data,
	};
	// Note: messages are always acknowledged by default. This means that you'll
	// always receive a confirmation back that the message has been received by the
	// server and forwarded to the recipients. If you do not want this to happen,
	// just add an ack:false property to the message above, and server won't send
	// you a response (meaning you just have to hope it succeeded).
	textroom.data({
		text: JSON.stringify(message),
		error: function(reason) { Janus.error(reason); },
		success: function() { Janus.log('Success!'); }
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
				error: function(reason) { Janus.error(reason); },
				success: function() {
				}
			});
}

// Helper to format times
function getDateString(jsonDate) {
	var when = new Date();
	if(jsonDate) {
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
		randomString += charSet.substring(randomPoz,randomPoz+1);
	}
	return randomString;
}
