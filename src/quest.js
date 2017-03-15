import invariant from 'invariant';
import React from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import when from 'recompose/branch';
import mapProps from 'recompose/mapProps';
import withProps from 'recompose/withProps';
import renderNothing from 'recompose/renderNothing';
import { omitProps } from './utils';
import { startQuest, resolveQuest } from './actions';
import { defaultState } from './reducer';

var never = () => false;

var promises = {};

var quest = (
  {
    query = null,
    resolver,
    mapData,
    mapToProps,
    fetchOnServer = true,
    fetchOnce,
    refetchWhen = never,
    // undocumented options
    defaultData,
    waitForData = false,
    mapDirect = false
  },
  branch
) => {
  invariant(typeof resolver === 'object', 'quests must be passed a resolver');
  invariant(typeof resolver.key === 'string', 'resolvers must contain a valid key');
  invariant(typeof resolver.get === 'function', 'resolvers must contain a get() method');

  var key = resolver.key;

  return compose(
    // map data already in store to a data prop
    connect(
      state => ({
        [key]: state._data_[key] || defaultState
      }),
      (dispatch, props) => ({
        updateData: (next, nextProps) => {
          var options = {
            query: (
              typeof query === 'function' ? query(nextProps || props) : query
            )
          };
          if (next === undefined) {
            return dispatch(startQuest(key, resolver.get.bind(null, options)));
          } else if (typeof next === 'function') {
            return dispatch(startQuest(key, next));
          }
          return dispatch(resolveQuest(key, next));
        }
      })
    ),
    Base => class extends React.Component {
      componentWillMount() {
        this.fetched = false;

        this.canFetchOnce = nextProps => {
          if (
            // prevent fetching on every prop change
            this.fetched ||
              // don't refectch if store already hydrated
              this.props[key].ready
          ) {
            return false;
          }
          if (
            // can fetch immediately
            !fetchOnce ||
              // if the data failed (on the server), try again (on client)
              this.props[key].error
          ) {
            return true;
          }
          if (typeof fetchOnce !== 'function') {
            return !!fetchOnce;
          }
          if (fetchOnce(nextProps || this.props)) {
            return true;
          }
        };

        // dispatch update if data isn't already being fetched into the store
        if (fetchOnServer && this.canFetchOnce()) {
          var r = this.props.updateData();
          if (r && r.then) {
            promises[key] = r.then(() => {
              delete promises[key];
            });
          }
          return r;
        }

        // if the quest is loading return the promise for ssr
        if (this.props[key].loading && promises[key]) {
          return promises[key];
        }
      }

      componentDidMount() {
        if (!fetchOnServer && this.canFetchOnce()) {
          this.fetched = true;
          this.props.updateData();
        }
      }

      componentWillReceiveProps(nextProps) {
        if (
          this.canFetchOnce(nextProps) || refetchWhen(this.props, nextProps)
        ) {
          this.fetched = true;
          this.props.updateData(undefined, nextProps);
        }
      }

      render() {
        return <Base {...this.props} />;
      }
    },
    // connect to the store again in case the dispatch(updateData) call
    // in componentWillMount resolved sychronously
    // Necesary for server rendering so sync quests can be run in single pass
    connect(state => ({
      [key]: state._data_[key] || initialState
    })),
    // add programatic methods
    withProps(props =>
      Object.keys(resolver).filter(key => typeof key === 'function').reduce((
        accProps,
        method
      ) => ({
        ...accProps,
        // methods can be called with a query
        [key]: {
          ...props[key],
          [method]: query => props.updateData(
            resolver[method]({
              ...query,
              data: props[key].data
            })
          )
        }
      }), {})),
    // Programatic GET handles update itself
    // withProps(props => ({
    //   [`get${capitalize(key)}`]: () => props.updateData()
    // })),
    // Once there's the data is resolved, we can manipulate the resulting data
    when(
      props => mapData && hasData(props[key]),
      mapProps(props => ({
        ...props,
        [key]: {
          ...props[key],
          data: mapData(props[key].data)
        }
      })),
      c => c
    ),
    when(
      props => mapToProps && hasData(props[key]),
      mapProps(props => ({
        ...props,
        ...mapToProps(props[key].data, props)
      })),
      c => c
    ),
    // in certain cases e.g. the resulting data is always resolved
    // the data can be mapped directly to the key prop
    when(
      props => mapDirect && hasData(props[key]),
      mapProps(props => ({
        ...props,
        [key]: props[key].data
      })),
      c => c
    ),
    when(
      props => waitForData && (!hasData(props[key]) || hasError(props[key])),
      branch ? branch : renderNothing,
      c => c
    ),
    when(
      props => !hasData(props[key]) && defaultData,
      mapProps(props => ({
        ...props,
        [key]: {
          ...props[key],
          data: (
            typeof defaultData === 'function' ? defaultData(props) : defaultData
          )
        }
      })),
      c => c
    ),
    omitProps(['updateData'])
  );
};

function hasData(state) {
  return state.data !== null;
}

function hasError(state) {
  return !!state.error;
}

quest.sync = opts => quest({ ...opts, mapDirect: true, waitForData: true });

export default quest;
