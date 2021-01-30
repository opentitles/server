declare type Listener = {
  /* name by which the listener is identified */
  name: string;
  /* organisations for which title change should be send to this listener */
  interestedOrgs: string[];
  /* URI where the listener can be reached with the payload */
  webhookuri: string;
}

declare type MediaDefinition = {
  feeds: FeedList;
}

declare type FeedList = {
  [key: string]: MediumDefinition[];
}

declare type MediumDefinition = {
  name: string;
  prefix: string;
  suffix: string;
  feeds: string[];
  id_container: string;
  id_mask: string;
  page_id_location: string;
  page_id_query: string;
  match_domains: string[];
  title_query: string;
}

declare type Article = {
  _id?: string;
  org: string;
  articleID: string;
  feedtitle: string;
  sourcefeed: string;
  lang: string;
  link: string;
  guid: string;
  titles: Title[];
  first_seen: string;
  pub_date: string;
}

declare type Title = {
  title: string;
  datetime: string;
  timestamp: number;
}

declare module 'express-prometheus-middleware' {
  import express = require('express');

  interface Labels {
    route: string;
    method: string;
    status: string;
    /** Custom labels */
    [key: string]: string;
  }

  interface UserOptions {
    /** Url route that will expose the metrics for scraping. Defaults to '/metrics' */
    metricsPath?: string;
    /** Express app that will expose metrics endpoint, if an app is provided, use it, instead of instantiating a new one */
    metricsApp?: express.Express;
    /**
     * Optional authentication predicate, the function should receive as argument, the req object and return truthy for sucessfull authentication, or falsy, otherwise.
     * This option supports Promise results.
     */
    authenticate?: ((req: express.Request) => boolean) | ((req: express.Request) => Promise<boolean>);
    /** Whether or not to collect prom-client default metrics. These metrics are usefull for collecting saturation metrics, for example. Defaults to true */
    collectDefaultMetrics?: boolean;
    /**
     * Whether or not to collect garbage collection metrics via module prometheus-gc-stats.
     * Dependency prometheus-gc-stats is marked as optional, hence if this option is set to true but npm/yarn could not install the dependency,
     * no garbage collection metric will be collected. Defaults to false.
     */
    collectGCMetrics?: boolean;
    /** Buckets for the request duration metrics (in milliseconds) histogram. */
    requestDurationBuckets?: number[];
    /** Optional, list of regexes to be used as argument to url-value-parser, this will cause extra route params, to be replaced with a #val placeholder. */
    extraMasks?: RegExp[];
    /** Optional prefix for the metrics name. By default, no prefix is added. */
    prefix?: string;
    /** Optional Array containing extra labels, used together with transformLabels */
    customLabels?: string[];
    /** Optional function(labels, req, res) adds to the labels object dynamic values for each label in customLabels */
    transformLabels?: (labels: Labels, req: express.Request, res: express.Response) => void;
  }

  function expressPrometheusMiddleware(userOptions: UserOptions): express.Express;
  export = expressPrometheusMiddleware;
}