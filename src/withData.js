import { compose } from 'redux';
import { connect } from 'react-redux';
import withProps from 'recompose/withProps';
import lifecycle from 'recompose/lifecycle';
import omitProps from './omitProps';
import { updateData } from '../ducks/_data_/actions';
import { initialState } from '../ducks/_data_/reducer';

var never = () => false;

var withData = ({
  resolver,
  selector,
  mapToProps,
  async = false,
  immutable = false,
  reloadWhen = never
}) => {
  var key = resolver.key;
  return compose(
    // map data already in store to a data prop
    connect(
      state => ({
        [key]: state._data_[key] || initialState
      }),
      (dispatch, props) => ({
        update: next => {
          if (next === undefined) {
            dispatch(updateData(key, resolver.get.bind(null, props)));
          } else if (typeof next === 'function') {
            dispatch(updateData(key, next));
          } else {
            dispatch(updateData(key, () => Promise.resolve({ result: next })));
          }
        }
      })
    ),
    lifecycle({
      componentWillMount() {
        // Call resolver with props - resolver = props => fn(props)
        this.getData = resolver.get.bind(null, this.props);
        // if the data isn't already being fetched into the store add it
        if (!async && !this.props[key].completed && !this.props[key].inProgress) {
          this.props.update();
        }
      },
      componentDidMount() {
        // if the data failed on the server, try again on client
        if (async || this.props[key].error) {
          this.props.update();
        }
      },
      componentWillReceiveProps(nextProps) {
        if (reloadWhen(this.props, nextProps)) {
          this.props.update();
        }
      }
    }),
    // add programatic methods
    withProps(props => Object.keys(resolver).reduce(
      (result, method) => ({
        ...result,
        // allow method to be called with some options and a dispatcher
        // so the resolver can take responsibility for updating the cached data
        [`${method}${capitalize(key)}`]: options => resolver[method]({
          ...options,
          props,
          data: props[key].result,
          update: props.update
        })
      }), {})
    ),
    // Programatic GET handles update itself
    withProps(props => ({
      [`get${capitalize(key)}`]: () => props.update()
    })),
    omitProps(['update'])
  );
};

export default withData;

function capitalize(string) {
  return string[0].toUpperCase() + string.slice(1);
}
