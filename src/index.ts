import moment from 'moment';
import express from 'express';
import prometheus from 'express-prometheus-middleware';
import fs from 'fs';
import cors from 'cors';
import { MongoClient, Db } from 'mongodb';
import * as Sentry from '@sentry/node';
import * as Tracing from "@sentry/tracing";
import { Clog, LOGLEVEL } from '@fdebijl/clog';

import * as CONFIG from './config';
import { articleIdIsValid } from './util/article';

const clog = new Clog();

const app = express();
app.use(Sentry.Handlers.requestHandler());
app.use(express.json());
app.use(cors({credentials: true, origin: true}));

if (process.env.DSN) {
  Sentry.init({
    dsn: process.env.DSN,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Tracing.Integrations.Express({ app })
    ]
  });
}

if (CONFIG.EXPECTED_TELEMETRY_AUTH) {
  app.use(prometheus({
    metricsPath: `/v${CONFIG.REV}/metrics`,
    collectDefaultMetrics: true
  }))
}

if (!fs.existsSync('media.json')) {
  throw new Error('Media.json could not be found in the server directory.');
} const mediaConfig = JSON.parse(fs.readFileSync('media.json', 'utf8')) as MediaDefinition;

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

/**
 * Get all countries that have media organizations tracked by OpenTitles
 * @since v2
 * @method GET
 */
app.get(`/v${CONFIG.REV}/country`, function(req, res) {
  res.json(Object.keys(mediaConfig.feeds));
});

/**
 * Get all media organizations in a single country
 *
 * @since v2
 * @method GET
 */
app.get(`/v${CONFIG.REV}/country/:int/org`, function(req, res) {
  const artint = req.params.int;

  if (!mediaConfig.feeds[artint]) {
    res.status(404).json({
      error: 'No such country',
      lookat: `/v${CONFIG.REV}/country`
    })
  } else {
    res.json(mediaConfig.feeds[artint].map(org => org.name));
  }
});

/**
 * Get the definition for a single medium in a given country
 *
 * @since v2
 * @method GET
 */
app.get(`/v${CONFIG.REV}/country/:int/org/:org`, function(req, res) {
  const artint = req.params.int;
  const artorg = decodeURIComponent(req.params.org);

  if (!mediaConfig.feeds[artint]) {
    res.status(404).json({
      error: 'No such country',
      lookat: `/v${CONFIG.REV}/country`
    })
  } else {
    const org = mediaConfig.feeds[artint].find(org => org.name == artorg);

    if (!org) {
      res.status(404).json({
        error: 'No such organization',
        lookat: `/v${CONFIG.REV}/country/${artint}/org`
      });
    } else {
      res.json(org);
    }
  }
});

/**
 * Get a list of the 20 most recent articles for a given organization
 * TODO: Pagination via HATEOAS
 *
 * @since v2
 * @method GET
*/
app.get(`/v${CONFIG.REV}/country/:int/org/:org/article`, async (req, res) => {
  const artint = req.params.int;
  const artorg = decodeURIComponent(req.params.org);

  const find = {
    lang: artint,
    org: artorg
  }

  try {
    const articles = await dbo.collection('articles').find(find).sort({_id: -1}).limit(20).toArray();

    if (!articles) {
      res.status(404).json({
        error: 'No articles found for the the given org'
      });
      return;
    }

    if (articles.length === 0) {
      res.status(404).json({
        error: 'No articles found for the the given org'
      });
      return;
    }

    res.json(articles);
  } catch (e) {
    res.status(500).json({
      error: 'Error occured while searching for articles for org'
    })
  }
});

/**
 * Get a single article for a single medium in a single country
 *
 * @since v2
 * @method GET
 */
app.get(`/v${CONFIG.REV}/country/:int/org/:org/article/:id`, function(req, res) {
  const artint = req.params.int;
  const artorg = decodeURIComponent(req.params.org);
  const artid = decodeURIComponent(req.params.id);

  if (!artid || !artorg || !articleIdIsValid(artid)) {
    res.sendStatus(400);
    return;
  }

  const find = {
    lang: artint,
    org: artorg,
    articleID: artid,
  };

  dbo.collection('articles').findOne(find, function(err, article) {
    if (err) {
      clog.log(err as unknown as string, LOGLEVEL.ERROR);
      return;
    }

    res.json(article);
  });
});

app.post(`/v${CONFIG.REV}/suggest`, function(req, res) {
  res.end();

  let bod = req.body;
  if (typeof(bod) !== 'object') {
    bod = JSON.parse(bod);
  }

  if (!bod.url) {
    return;
  }

  const find = {
    url: `${bod.url}`,
  };

  dbo.collection('suggestions').findOne(find, function(err, suggestion) {
    if (err) {
      clog.log(err as unknown as string);
      return;
    }

    if (!suggestion) {
      const newentry = {
        url: `${bod.url}`,
        rss_present: bod.hasrss,
        rss_overview: bod.rss_overview,
        has_id: bod.has_id,
        datetime: moment().format('MMMM Do YYYY, h:mm:ss a'),
      };

      dbo.collection('suggestions').insertOne(newentry);
    }
  });
});

app.get(`/v${CONFIG.REV}/suggest`, function(req, res) {
  dbo.collection('suggestions').find({}).toArray(function(err, suggestions) {
    if (err) {
      clog.log(err as unknown as string);
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
      clog.log(`OpenTitles API Server is running on port ${process.env.PORT || CONFIG.PORT} with revision ${CONFIG.REV}`)
    });
  })
  .catch((error) => {
    clog.log(`OpenTitles API Server failed to start: ${error}`, LOGLEVEL.FATAL);
    Sentry.captureException(error);
    process.exit(1);
  });