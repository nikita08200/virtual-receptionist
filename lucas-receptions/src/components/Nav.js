import React from 'react';
import { Link } from 'react-router-dom'

class Nav extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            navigate: false,
        }
        this.Logout = this.Logout.bind(this);

    }

    Logout() {
        localStorage.clear("username");
        localStorage.clear("auth");
        window.location.href = '/login';
    }

    render() {    
        return (
            <div>
                <header className="header-6" id="subnav12">
                    <div className="branding">
                        <Link to="/">
                            <clr-icon shape="home" className="is-solid"></clr-icon>
                            <span className="title">Lucas Therapies</span>
                        </Link>
                    </div>
                    <div className="header-nav">
                        <Link to="/dash"> <ul className="nav-link nav-text">Admin</ul></Link>
                        {/* <Link to="/reception"><ul className="nav-link nav-text">Reception</ul></Link> */}
                    </div>
                    <div className="header-actions">
                        <a className="nav-link nav-text">
                            Reports
                    </a>
                        <a className="nav-link nav-text">
                            Settings
                    </a>
                        <a className="nav-link nav-text">
                            Support
                    </a>
                        <a href="" onClick={this.Logout} className="nav-link nav-text">
                            LogOut
                    </a>
                    </div>
                </header>
                <nav className="subnav" id="subnav11">
                    {/* <ul className="nav">
                        <li className="nav-item">
                            <Link className="nav-link" target="_blank" to="/reception/eastend">East End</Link>
                        </li>
                        <li className="nav-item">
                            <Link to="/reception/westend" target="_blank" className="nav-link">West End</Link>
                        </li>
                        <li className="nav-item">
                            <Link to="/reception/danbury" target="_blank" className="nav-link">Danbury</Link>
                        </li>
                        <li className="nav-item">
                            <Link to="/reception/elmont" target="_blank" className="nav-link">Elmont</Link>
                        </li>
                    </ul> */}
                </nav>
            </div>
        )
    }

}

export default Nav;
