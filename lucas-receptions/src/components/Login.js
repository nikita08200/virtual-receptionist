import React from 'react';
import Auth from './Auth';


class Login extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            name: "",
            pass: "",
            error: null,
            shouldHideAdmin: false,
            shouldHideRecep: true,
            location: "bonsack",
            profile: "Admin",
            loading: false
        }
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleUser = this.handleUser.bind(this);
        this.handlePass = this.handlePass.bind(this);
        this.changeProfile = this.changeProfile.bind(this);
        this.selectLocation = this.selectLocation.bind(this);
    }

    handleUser(event) {
        this.setState({ name: event.target.value, error: null });
    }
    handlePass(event) {
        this.setState({ pass: event.target.value, error: null });
    }

    async handleSubmit() {
      try {
        this.setState({ loading: true });
        const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/api/login`, {
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'POST',
          body: JSON.stringify({
            user: this.state.name || this.state.location,
            password: this.state.pass,
            role: this.state.profile.toLowerCase()
          })
        });

        const { success } = await response.json();
        if (success) {
          localStorage.setItem('username', this.state.name);
          localStorage.setItem('auth', true);
          this.props.LoginFunc();
          Auth.authenticate();
          if (this.state.profile === "Reception") {
            var loc = '/reception/' + this.state.location;
            this.props.history.push(loc);
          } else {
            this.props.history.push("/dash");
          }
        } else {
          this.setState({ error: true });
        }
      } catch (error) {
        this.setState({ error });
      } finally {
        this.setState({ loading: false });
      }
    }

    changeProfile(event) {
        var ca = event.currentTarget.value;
        if (ca === "Reception") {
            this.setState({ shouldHideAdmin: true });
            this.setState({ shouldHideRecep: false });
            this.setState({ profile: "Reception", name: "" });
        } else {
            this.setState({ shouldHideRecep: true });
            this.setState({ shouldHideAdmin: false });
            this.setState({ profile: "Admin", name: "" });
        }
    }

    selectLocation(event) {
        var ca = event.currentTarget.value;
        this.setState({ location: ca, name: "", error: null });
    }
    render() {
        const styleAdmin = this.state.shouldHideAdmin ? { display: 'none' } : {};
        const styleProfile = this.state.shouldHideRecep ? { display: 'none' } : {};
        return (
            <div>
                <header className="header-6" id="subnav12">
                    <div className="branding">
                        <clr-icon shape="home" className="is-solid"></clr-icon>
                        <span className="title">Lucas Therapies</span>
                    </div>
                    <div className="header-nav">
                    </div>
                </header>
                <div style={{ height: "100px" }}></div>
                <div className="content-area">
                    <div className="clr-row">
                        <div className="clr-col-4">
                        </div>
                        <div className="clr-col-6">
                            <div className="clr-form clr-form-horizontal">
                                <div className="clr-form-control">
                                    <label className="clr-control-label" >User</label>
                                    <div className="clr-control-container">
                                        <div className="clr-input-wrapper">
                                            <select cname="options" onChange={this.changeProfile}>
                                                <option value="Admin">Reception</option>
                                                <option value="Reception">Location</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div style={styleAdmin}>
                                    <div className="clr-form-control">
                                        <label className="clr-control-label" >Admin Name</label>
                                        <div className="clr-control-container">
                                            <div className="clr-input-wrapper">
                                                <input className="clr-input" placeholder="Name" type="text" onChange={this.handleUser} value={this.state.name} id="example2"></input>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="clr-form-control">
                                        <label className="clr-control-label" >Password</label>
                                        <div className="clr-control-container">
                                            <div className="clr-input-wrapper">
                                                <input className="clr-input" placeholder="Password" value={this.state.pass} onChange={this.handlePass} type="password" id="pass"></input>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div style={styleProfile}>
                                    <div className="clr-form-control">
                                        <label className="clr-control-label" >Location</label>
                                        <div className="clr-control-container">
                                            <div className="clr-input-wrapper">
                                                <select onChange={this.selectLocation}>
                                                    <option value="bonsack">Bonsack</option>
                                                    <option value="brambleton">Brambleton</option>
                                                    <option value="north_roanoke">North Roanoke</option>
                                                    <option value="mcdowell">McDowell</option>
                                                    <option value="knotbreak">Knotbreak</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="clr-form-control">
                                        <label className="clr-control-label" >Password</label>
                                        <div className="clr-control-container">
                                            <div className="clr-input-wrapper">
                                                <input className="clr-input" placeholder="Password" value={this.state.pass} onChange={this.handlePass} type="password" id="pass"></input>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="clr-form-control">
                                  <button disabled={this.state.loading} className="btn btn-outline" onClick={this.handleSubmit}>Submit</button>
                                </div>
                                <div className="clr-form-control">
                                  {this.state.loading && <div>Signing in...</div>}
                                  {this.state.error && <div className="label label-danger">Your credentials are not authorized</div>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* <div class="alert alert-danger" role="alert">
                                    <div class="alert-items">
                                        <div class="alert-item static">
                                            <div class="alert-icon-wrapper">
                                                <clr-icon class="alert-icon" shape="exclamation-circle"></clr-icon>
                                            </div>
                                            <span class="alert-text">Invalid Credentials</span>
                                        </div>
                                    </div>
                                </div> */}
                </div>
            </div>
        )
    }
}

export default Login;

