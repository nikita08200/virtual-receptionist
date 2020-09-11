require('dotenv').config();

const express = require('express');
const cors = require('cors');
const auth = require('./auth.js');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(bodyParser.json());

app.post('/api/login', (req, res, next) => {
  const { user, password, role } = req.body;

  if (!user || !password || !role || !auth[role][user]) {
    console.log(`missing arguments for ${role}:${user}`);
    return res.json({ success: false });
  }

  const success = bcrypt.compareSync(password, auth[role][user]);

  console.log(`/api/login hit by ${user}: result is ${success ? 'success' : 'failure'}`);
  return res.json({ success });
});

app.listen(PORT, () => {
  console.log(`listening in port ${PORT}`);
});
