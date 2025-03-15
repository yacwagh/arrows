exports.getAllUsers = (req, res) => {
    // Retrieve list of users from database
    res.send("All users");
  };
  
  exports.createUser = (req, res) => {
    // Insert user into database
    res.send("User created");
  };
  