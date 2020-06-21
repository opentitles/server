import moment from 'moment';
import express from 'express';
import cors from 'cors';
import { MongoClient, Db } from 'mongodb';
import * as CONFIG from './config';
import { articleIdIsValid } from './util/article';
import { clog } from './util/logging';
import * as Sentry from '@sentry/node';

if (process.env.DSN) {
  Sentry.init({ dsn: process.env.DSN });
}

const app = express();
app.use(Sentry.Handlers.requestHandler());
app.use(express.json());
app.use(cors({credentials: true, origin: true}));

let dbo: Db;

const init = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!CONFIG.MONGO_URL) {
      reject('MONGO_URL was not defined');
      return;
    }

    /**
     * Connect once and use the dbo reference in every call from here on out
     */
    MongoClient.connect(CONFIG.MONGO_URL, {
      appname: 'OpenTitles API',
      useNewUrlParser: true,
      useUnifiedTopology: true,
      connectTimeoutMS: 5000,
    }, function(err, database) {
      if (err) {
        reject(err);
      }

      dbo = database.db('opentitles');
      resolve();
    });
  });
}

app.get(['/opentitles/article/:org/:id', '/article/:org/:id'], function(req, res) {
  const artid = decodeURIComponent(req.params.id);
  const artorg = decodeURIComponent(req.params.org);

  if (!artid || !artorg || !articleIdIsValid(artid)) {
    res.sendStatus(400);
    return;
  }

  const find = {
    org: artorg,
    articleID: artid,
  };

  dbo.collection('articles').findOne(find, function(err, article) {
    if (err) {
      clog(err);
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(article, null, 4));
  });
});

app.post(['/opentitles/suggest', '/suggest'], function(req, res) {
  res.end();

  let bod = req.body;
  if (typeof(bod) !== 'object') {
    bod = JSON.parse(bod);
  }

  if (!bod.url) {
    return;
  }

  const find = {
    url: bod.url,
  };

  dbo.collection('suggestions').findOne(find, function(err, suggestion) {
    if (err) {
      clog(err);
      return;
    }

    if (!suggestion) {
      const newentry = {
        url: bod.url,
        rss_present: bod.hasrss,
        rss_overview: bod.rss_overview,
        has_id: bod.has_id,
        datetime: moment().format('MMMM Do YYYY, h:mm:ss a'),
      };

      dbo.collection('suggestions').insertOne(newentry);
    }
  });
});

app.get(['/opentitles/suggest', '/suggest'], function(req, res) {
  dbo.collection('suggestions').find({}).toArray(function(err, suggestions) {
    if (err) {
      clog(err);
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(suggestions, null, 4));
  });
});

app.use(Sentry.Handlers.errorHandler());

init()
  .then(() => {
    app.listen(process.env.PORT || CONFIG.PORT, () => {
      clog(`OpenTitles API Server is running on port ${process.env.PORT || CONFIG.PORT}`)
    });
  })
  .catch((error) => {
    clog(`OpenTitles API Server failed to start: ${error}`);
    Sentry.captureException(error);
    process.exit(1);
  });