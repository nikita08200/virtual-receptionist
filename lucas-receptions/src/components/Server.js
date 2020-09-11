import React from 'react';
import pause from '../images/pause.png';
import message from '../images/message.png';
import hangup from '../images/hangup.png';
import mic from '../images/mic.png';
import video from '../images/video.png';
import claimIcon from '../images/Group3.png';
import onCall from '../images/oncall.png';
import offline from '../images/location_offline.png';
import Nav from './Nav';
import {
  doHangup, startJanusServerRoom, doCall, registerUserForCall,
  stopMirrorVideo, onMutedMirror, onHoldHangup, destroyJanusConnection,
  restartJanusServerRoom
} from './janusServer';

class Server extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      username: '',
      calledLocation: '',
      onCall: false,
      usersList: []
    }
    this.Call = this.Call.bind(this);
    this.hangUp = this.hangUp.bind(this);
    this.onHold = this.onHold.bind(this);
  }

  componentWillMount() {
    this.setState({ username: localStorage.getItem('username') });
    this.interval = setInterval(() => {
      if (!this.state.onCall) {
        restartJanusServerRoom()
      }
    }, 120000);
  }

  componentWillUnmount() {
    doHangup();
    this.setState({ onCall: false });
    destroyJanusConnection();
    window.removeEventListener('beforeunload', destroyJanusConnection);
    window.removeEventListener('pagehide', destroyJanusConnection);
    clearInterval(this.interval);
  }

  hangUp() {
    doHangup();
    this.setState({ onCall: false });
  }

  Call(event) {
    var ca = event.currentTarget.dataset.userId;
    if (this.state.onCall && this.state.calledLocation === ca)
      return;
    if (ca) {
      console.info(`Call to: ${ca}`);
      this.setState({ calledLocation: ca.replace('_', ' ') });
      doCall(ca);
      this.setState({ onCall: true });
    }
  }

  onHold() {
    onHoldHangup();
    this.setState({ onCall: false });
  }

  trunc(s, n) {
    return (s.length > n) ? s.substring(0, n - 1) + '...' : s;
  }

  componentDidMount() {
    startJanusServerRoom(this.state.username);
    window.addEventListener('beforeunload', destroyJanusConnection);
    window.addEventListener('pagehide', destroyJanusConnection);
  }

  render() {
    return (
      <div className="content-container" >
        <div className="content-area" style={{ padding: "inherit" }}>
          <div className="clr-row">
            <div className="clr-col-12">
              <div className="card-block">
                <div className="card-media-block clr-row">
                  <div className="clr-col-4 clr-offset-sm-1">
                    <div style={{ width: "600px", height: "400px" }}>
                      <div id="videoright"></div>
                    </div>
                  </div>
                  <div className="clr-col-2 clr-offset-sm-4">
                    <div className="card-media-description ">
                      <span className="card-media-title">
                        {(this.state.onCall) ? ("LOCATION: " + this.state.calledLocation) : ''}
                      </span>
                      <span display="none" className="card-media-text" style={{ marginTop: "20px" }}>
                        <button className="btn btn-link" style={{ height: "80px" }} onClick={this.onHold}><img src={pause}></img></button>
                      </span>
                      &nbsp;
                      <span className="card-media-text">
                        <button className="btn btn-link" style={{ height: "80px" }} onClick={this.hangUp}>
                          <img src={hangup}></img>
                        </button>
                      </span>
                    </div>
                  </div>

                </div>
              </div>
              <div className="clr-row">
                <div className="clr-col-2" >
                  <div onClick={this.Call} id="videoremote1" className="container">
                    <img src={offline} id="img1" className="card-media-image" style={{ width: "150px", height: "113px" }}></img>
                  </div>
                </div>
                <div className="clr-col-1"></div>
                <div className="clr-col-2" ><div onClick={this.Call} id="videoremote2" className="container"><img src={offline} id="img2" className="card-media-image" style={{ width: "150px", height: "113px" }}></img></div>
                </div>
                <div className="clr-col-1"></div>
                <div className="clr-col-2"><div onClick={this.Call} id="videoremote3" className="container"><img src={offline} id="img1" className="card-media-image" style={{ width: "150px", height: "113px" }}></img></div></div>
                <div className="clr-col-1"></div>
                <div className="clr-col-2"><div onClick={this.Call} id="videoremote4" className="container"><img src={offline} id="img1" className="card-media-image" style={{ width: "150px", height: "113px" }}></img></div></div>
              </div>
              &nbsp;
                <div className="clr-row">
                <div className="clr-col-2"><div onClick={this.Call} id="videoremote5" className="container"><img src={offline} id="img3" className="card-media-image" style={{ width: "150px", height: "113px" }}></img></div></div>
                <div className="clr-col-1"></div>
                <div className="clr-col-2"><div onClick={this.Call} id="videoremote6" className="container"><img src={offline} id="img1" className="card-media-image" style={{ width: "150px", height: "113px" }}></img></div></div>
                <div className="clr-col-1"></div>
                <div className="clr-col-2"><div onClick={this.Call} id="videoremote7" className="container"><img src={offline} id="img1" className="card-media-image" style={{ width: "150px", height: "113px" }}></img></div></div>
                <div className="clr-col-1"></div>
                <div className="clr-col-2"><div onClick={this.Call} id="videoremote8" className="container"><img src={offline} id="img1" className="card-media-image" style={{ width: "150px", height: "113px" }}></img></div></div>
              </div>
              &nbsp;
                <div className="clr-row">
                <div className="clr-col-3"><div onClick={this.Call} id="videoremote9" className="container"><img src={offline} id="img3" className="card-media-image" style={{ width: "150px", height: "113px" }}></img></div></div>
                <div className="clr-col-3"><div onClick={this.Call} id="videoremote10" className="container"><img src={offline} id="img1" className="card-media-image" style={{ width: "150px", height: "113px" }}></img></div></div>
                <div className="clr-col-3"><div onClick={this.Call} id="videoremote11" className="container"><img src={offline} id="img1" className="card-media-image" style={{ width: "150px", height: "113px" }}></img></div></div>
                <div className="clr-col-3"><div onClick={this.Call} id="videoremote12" className="container"><img src={offline} id="img1" className="card-media-image" style={{ width: "150px", height: "113px" }}></img></div></div>
              </div>
            </div>
          </div>
        </div>
        <div className="content-area sidebar" style={{ padding: "inherit", background: "#d8e3e9" }}>
          <div className="clr-col-12">
            <div className="clr-row">
              <div id="videoleft"></div>
            </div>
            <div className="video-controls">
              <div className="username">
                <h4>{(this.state.username) ? this.trunc(this.state.username, 8) : 'unknown'}</h4>
              </div>
              <div className="buttons">
                <button className="btn btn-link" style={{ height: "70px" }} onClick={stopMirrorVideo}>
                  <img id="videoimg" src={video}></img>
                </button>
                <button className="btn btn-link" style={{ height: "70px" }} onClick={onMutedMirror}>
                  <img id="micimg" src={mic}></img>
                </button>
              </div>
            </div>
            <div className="clr-row">
              <div className="clr-col-3">
                <div className="admin" id="videoadmin1"></div>
              </div>
              <div className="clr-col-3">
                <div className="admin" id="videoadmin2"></div>
              </div>
              <div className="clr-col-3">
                <div className="admin" id="videoadmin3"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default Server;
