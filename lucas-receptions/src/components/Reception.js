import React from 'react';
import claimIcon from '../images/Group2.png';
import proc from '../images/imageProce.png';
import { startJanusServerRoom, doCall, getListOfPeers, doSendClaim, destroyJanusConnections} from './janusReception';
const lucas_therapies_base = {
    locations: ["Brambleton", "Bonsack", "North Roanoke", "McDowell", "Knotbreak"],
};

class Reception extends React.Component {
  constructor(props) {
    super(props);
    this.CallServer = this.CallServer.bind(this);
    this.sendData = this.sendData.bind(this);
  }

  onUnload = (event) => { // the method that will be used for both add and remove event  
    destroyJanusConnections();
    localStorage.clear("username");
    localStorage.clear("auth");
  }

  componentDidMount() {

    this.setState({ username: this.props.match.params.id });
    startJanusServerRoom(this.props.match.params.id);

    window.addEventListener('beforeunload', this.onUnload);
    window.addEventListener('pagehide', this.onUnload);
  }

  CallServer = () => {
    this.getFirstAdmin(this, (admin) => {
        console.log(`First admin found is ${admin}. Calling...`);
        doCall(admin);
    });
  }

  sendData() {
    doSendClaim(this.props.match.params.id);
  }

  getFirstAdmin = (that, adminCallback) => {
    let locations = that.joinAndLowercaseArray(lucas_therapies_base.locations);
    return getListOfPeers((listOfUsers) => {
      let i = 0;
      while (listOfUsers.length > i && locations.includes(listOfUsers[i])) {
        i++;
      }
      if (locations.includes(listOfUsers[i])) {
        return Error('No admin/reception available');
      }
      return adminCallback(listOfUsers[i]);
    });
  }

  joinAndLowercaseArray(arr) {
    arr.forEach((element, index, array) => {
      array[index] = array[index].split(' ').join('');
      array[index] = array[index].toLowerCase();
    });
    return arr;
  }

  componentWillUnmount() {
    window.removeEventListener('beforeunload', this.onUnload);
    window.removeEventListener('pagehide', this.onUnload);
    destroyJanusConnections();
  }

  render() {
    return (
      <div>
        <div>
          <header className="header-6" >
            <div className="branding">
              <span className="title">Lucas Therapies</span>
            </div>
          </header>
        </div>
        <div className="content-area">
          <div id="videoright" style={{ background: "black" }}></div>
          <div className="clr-row">
            <div className="clr-col-12">
              <div className="modal" style={{ position: "inherit",height: "80vh" }}>
                <div className="modal-dialog" role="dialog" aria-hidden="true">
                  <header className="header-6" >
                    <div className="branding">
                      <span className="title">Lucas Therapies</span>
                    </div>
                  </header>
                  <div className="modal-content">
                    <div className="modal-header">
                      <h3 className="modal-title">THANK YOU FOR VISITING LUCAS THERAPIES!</h3>
                    </div>
                    <div className="modal-body">
                      <p>Our attendants are currently assisting other patients, someone will be with you momentarily</p>
                    </div>
                    <div className="modal-footer">
                      <img src={proc} alt="proc"></img>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-backdrop" aria-hidden="true"></div>
            </div>
          </div>

          <div className="clr-row">
            <div className="card-block" style={{ width: '100%', zIndex: '2000' }}>
              <div className="clr-row">
                <div className="clr-col-11 name-holder">
                  <h3 id="callername">{''}</h3>
                </div>
                <div className="clr-col-1" style={{ zIndex: '10000' }}>
                  <button className="btn btn-link" style={{ height: '80px' }}>
                    <img src={claimIcon} alt="clam" onClick={this.sendData}></img>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
      </div>
    )
  }
}

export default Reception;
