import React from 'react';
import '../node_modules/@clr/ui/clr-ui.min.css';
import '../node_modules/@clr/icons/clr-icons.min.css';
import '../node_modules/@webcomponents/custom-elements/custom-elements.min.js';
import '../node_modules/@clr/icons/clr-icons.min.js';
import './App.css';
import Reception from './components/Reception';
import Server from './components/Server';
import Nav from './components/Nav';
import Login from './components/Login';
import Auth from './components/Auth';
import LogOut from './components/LogOut';
import Home from './components/Home';

import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom'

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = { isAuthenticated: this.checkAuthenticated() };
    this.login = this.login.bind(this);
  }
  login() {
    this.setState({ isAuthenticated: localStorage.getItem('auth') });
    Auth.authenticate();
  }

  checkAuthenticated() {
    if (localStorage.getItem('auth')) {
      return true;
    } else {
      return false;
    }
  }

  render() {
    return (
      <Router>
        <div className="main-container">
          {this.state.isAuthenticated ? (
            <React.Fragment>
              <Nav />
              <Switch>
                <Route path="/" exact component={Home} />
                <Route path="/reception/:id" component={Reception} />
                <Route path="/dash" exact component={Server} />
                <Redirect to="/login" />
              </Switch>
            </React.Fragment>) :
            (<Switch>
              <Route path="/login" exact render={(props) => <Login {...props} LoginFunc={this.login} />} />
              <Redirect to="/login" />
            </Switch>)
          }
        </div>
      </Router>)
  }
}



export default App;

