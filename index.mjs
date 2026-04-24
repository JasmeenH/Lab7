import 'dotenv/config';
import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import session from 'express-session';

const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));

//for Express to get values using the POST method
app.use(express.urlencoded({ extended: true }));
//setting up database connection pool, replace values in red
const pool = mysql.createPool({
   host: "s9xpbd61ok2i7drv.cbetxkdyhwsb.us-east-1.rds.amazonaws.com",
   user: process.env.DB_USERNAME,
   password: process.env.DB_PWD,
   database: "eqnw3f2nna862mo2",
   connectionLimit: 10,
   waitForConnections: true
});

app.set('trust proxy', 1) // trust first proxy
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    //   cookie is not for local work
      // cookie: { secure: true }
}))

app.get("/", (req, res) => {
   res.render("login.ejs")
});

app.get("/authors", isUserAuthenticated, async (req, res) => {
   let sql = `SELECT authorId, firstName, lastName 
               FROM authors
               ORDER BY lastName`;

   const [authors] = await pool.query(sql);
   res.render("authors.ejs", { authors })
});

app.get("/updateAuthor", isUserAuthenticated, async (req, res) => {
   let authorId = req.query.authorId;
   let sql = `SELECT *, DATE_FORMAT(dob, '%Y-%m-%d') ISOdob, DATE_FORMAT(dod, '%Y-%m-%d') ISOdod
               FROM authors
               WHERE authorId = ?`;
   const [authorInfo] = await pool.query(sql, [authorId]);

   res.render("updateAuthor.ejs", { authorInfo })
});


app.post('/deleteAuthor', isUserAuthenticated, async (req, res) => {
   let authorId = req.query.authorId;

   let sql = `DELETE
            FROM authors
              WHERE authorId = ?
              `;
   let sqlParams = [authorId]
   const [rows] = await pool.query(sql, sqlParams);
   res.redirect('/authors')
});

app.post('/updateAuthor', isUserAuthenticated, async (req, res) => {
   let firstName = req.body.firstName;
   let lastName = req.body.lastName;
   let dob = req.body.dob;
   let sex = req.body.sex;
   let authorId = req.body.authorId;

   let sql = `UPDATE authors
              SET
              firstName = ?,
              lastName = ?,
              dob = ?,
              sex = ?
              WHERE authorId = ?
              `;
   let sqlParams = [firstName, lastName, dob, sex, authorId];
   const [rows] = await pool.query(sql, sqlParams);
   res.redirect('/authors')
});

app.get("/quotes", isUserAuthenticated, async (req, res) => {
   let sql = `SELECT quoteId, quote
               FROM quotes
               ORDER BY quote`;

   const [quotes] = await pool.query(sql);
   res.render("quotes.ejs", { quotes })
});

app.get("/updateQuote", isUserAuthenticated, async (req, res) => {
   let quoteId = req.query.quoteId;
   let sql = `SELECT *
               FROM quotes
               WHERE quoteId = ?`;
   const [quoteInfo] = await pool.query(sql, [quoteId]);
// get the list of full authors for author drop down list
   let author_sql = `SELECT authorId,  lastName, firstName
                     FROM authors`;
   const [authors] = await pool.query(author_sql);

   let category_sql = `SELECT DISTINCT category 
                        FROM quotes `;
   const [category] = await pool.query(category_sql)
   res.render("updateQuote.ejs", { quoteInfo, authors, category })
});

app.post('/updateQuote', isUserAuthenticated, async (req, res) => {
   let quoteId = req.body.quoteId;
   let authorId = req.body.authorId;
   let quote = req.body.quote;

   let sql = `UPDATE quotes
              SET
              quoteId = ?,
              authorId = ?,
              quote = ?,
              WHERE quoteId = ?
              `;
   let sqlParams = [quoteId, authorId, quote];
   const [rows] = await pool.query(sql, sqlParams);
   res.redirect('/authors')
});

// renders the quote form
app.get("/newQuote", isUserAuthenticated, async (req, res) => {
   let sql = `SELECT authorId,  lastName, firstName
                FROM authors
                ORDER BY lastName`
   const [authors] = await pool.query(sql);

   let authorId = req.query.authorId;
   let sql_1 = `SELECT quote, firstName, lastName, authorId
                    FROM quotes
                    NATURAL JOIN authors
                    WHERE authorId = ?`;
   let sqlParams = [authorId];

   const [rows] = await pool.query(sql_1, sqlParams);

   let category_sql = `SELECT DISTINCT category 
                        FROM quotes
                        ORDER BY category `
   const [category] = await pool.query(category_sql)

   let category_1 = req.query.category;
   let sql_category = `SELECT quote, firstName, lastName, authorId
                    FROM quotes
                    NATURAL JOIN authors
                    WHERE category = ?`;
   let sqlParams_category = [category_1];

   const [rows_category] = await pool.query(sql_category, sqlParams_category);

   res.render("newQuote.ejs", { authors, rows, category, rows_category })
});

// saves a new quote to the database
app.post("/newQuote", isUserAuthenticated, async (req, res) => {
   let quote = req.body.quote;
   let authorId = req.body.authorId;

   const params = [quote, authorId];
   const [rows] = await pool.query("INSERT INTO quotes (quote, authorId) VALUES (?,?)", params);

   res.redirect("/");
});

app.get("/newAuthor", isUserAuthenticated, (req, res) => {
   res.render("newAuthor.ejs")
});

app.post("/newAuthor", isUserAuthenticated, async (req, res) => {
   let firstName = req.body.author;
   let sex = req.body.gender;
   let dob = req.body.dob;
   let dod = req.body.dod;
   let biography = req.body.bio;
   let portrait = req.body.portrait;

   const params = [firstName, sex, dob, dod, biography, portrait];
   const [rows] = await pool.query("INSERT INTO authors (firstName, sex, dob, dod, biography, portrait) VALUES (?,?,?,?,?,?)", params);

   res.redirect("/");
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

//route that checks username and password
app.post('/loginProcess', async (req, res) => {
    let { username, password } = req.body;
   //  console.log(username + ": " + password);

    let hashedPassword = "";

    let sql = `SELECT *
              FROM admin
              WHERE username = ?`;
    const [rows] = await pool.query(sql, [username]);

    if (rows.length > 0) { //username was found in the database
        hashedPassword = rows[0].password;
    }

    const match = await bcrypt.compare(password, hashedPassword);

    if (match) {
        req.session.authenticated = true;
        req.session.fullName = rows[0].firstName + " " + rows[0].lastName;
        res.render('home.ejs', { "fullName": req.session.fullName });
    } else {
        let loginError = "Wrong Credentials! Try again!";
        res.render('login.ejs', { loginError });
    }
});

function isUserAuthenticated(req, res, next) {
    if (req.session.authenticated) {
        next();
    } else {
        res.redirect("/");
    }
}

// middleware function that sets user's fullName
app.use((req, res, next) => {
    res.locals.fullName = req.session.fullName || "";
    next(); //next middleware/route - the code that is going to be executed
});

app.listen(3000, () => {
   console.log("Express server running")
})

