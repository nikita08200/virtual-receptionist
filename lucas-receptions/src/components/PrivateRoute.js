import React from "react";
import { Route, Redirect } from "react-router-dom";
import Auth from './Auth';


function PrivateRoute(props){
  return(
<React.Fragment>
      { Auth.isAuthenticated ? props.children : <Redirect to="/login" /> }
  </React.Fragment>
  )
}

export default PrivateRoute;
