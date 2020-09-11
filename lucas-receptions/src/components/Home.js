import React from 'react';

class Home extends React.Component {
    constructor(props) {
        super(props);
    }
    componentDidMount() {
        localStorage.clear("username");
        localStorage.clear("auth");
        window.location.href = '/login';
    }

    render() {
        return (
            <h1>Home Page</h1>
        )
    }
}

export default Home;