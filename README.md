# Lucas Therapies Videos Reception 

This code contains Lucas Therapies video receptionist application
### Table of Contents

-   [Getting Started][1]
    -   [Prerequesites][2]
    -   [How to Run Janus Server][3]
    -   [How to Run React Application][3]
-   [How to Enter as a Reception][4]
    -   [Parameters][5]
-   [How to Enter as Location][6]
    -   [Parameters][7]  
-   [Auth Server][8]
-   [TODO/Known bugs][9]  


## Getting Started

The project involves a frontend app  which contains functionality to have videocalls One to Many and One to One.
A dashboard page for the Receptionist to see the multiple locations and select which one to have a videocall with.
The server uses Janus to make the videocalls possible.


### Prerequisites


### How to Run Janus Server

On the root of the project run the janus server

`docker-compose up --build`

### How to run the React Application

Run the frontend app using npm
on the root of the project navigate to lucas-receptions folder then run

```
npm install
npm start
```

### How to Enter as a Reception

After running the React App go to /login
Select Reception on the dropdown 
Type your credentials and login


### How to Enter as a Location

After running the React App go to /login
Select Location on the dropdown 

Type your credentials and login

### Auth server

To run the auth server you will need to do the following

```
cd server/
npm install
npm start
```

To add new users to the server, edit or create the `server/auth.js` file, this is an example of how it should
look

```javascript
module.exports = {
  'reception': {
    'somelocation': 'bcrypt-hashed-password-here',
  },
  'admin': {
    'someadmin': 'bcrypt-hashed-password-here',
  }
};
```

remember to add the URL of this server to `lucas-reception/.dockerenv`

``` bash
REACT_APP_SERVER_URL=http://localhost:8000
```

### TODO/Known bugs

* Backend database for storing user accounts, session information and settings.
* Fix `prod.sh` command, it succeeds but causes video timeouts after 15 minutes. For now use `dev.sh`.



