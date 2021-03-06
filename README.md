# react-quest

Declarative data fetching for universal React/Redux apps.

[![npm](https://img.shields.io/npm/v/react-quest.svg?style=flat-square)](http://npm.im/react-quest)
[![MIT License](https://img.shields.io/npm/l/react-quest.svg?style=flat-square)](http://opensource.org/licenses/MIT)
[![Travis](https://img.shields.io/travis/djgrant/react-quest.svg?style=flat-square)](https://travis-ci.org/djgrant/react-quest)

| Overview | [Documentation](#documentation) | [Examples](examples) |
|----------|----------------------|----------------------|


```js
import quest from 'react-quest';

const postsResolver = {
  key: 'posts',
  get() {
    return fetch('http://api.posts.com')
  }
};

const withPosts = quest({
  resolver: postsResolver
});

const Items = ({ posts }) => (
  <div>
    {posts.data
      ? posts.data.map(post => <Item entry={post} />)
      : <Loading />
    }
  </div>
);

export default withPosts(Items);
```

## Introduction

A lightweight (2kb gzip) yet impressively featured library for colocating components and their data requirements. Capable of mutating remote data, performing optimistic updates, reloading data on prop changes or programmatically, and much more!

## Documentation

- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Server side resolution](#server-side-resolution)
- [Creating resolvers](#creating-resolvers)
- [Calling resolver methods programmatically](#calling-resolver-methods-programmatically)
- [Deferring fetching to browser](#deferring-fetching-to-browser)
- [Fetching data on prop changes](#fetching-data-on-prop-changes)
- [Transforming resolved data](#transforming-resolved-data)
- [Mapping data to props](#mapping-data-to-props)
- [Passing a query to the resolver](#passing-a-query-to-the-resolver)
- [Adding mutation methods to resolvers](#adding-mutation-methods-to-resolvers)
- [Updating remote data](#updating-remote-data)
- [Performing optimistic updates](#performing-optimistic-updates)


### Prerequisites

react-quest leverages Redux to manage state and caching. Before proceeding with theup make sure you have the following packages installed:

- [react](https://facebook.github.io/react/)
- [redux](http://redux.js.org/#installation)
- [redux-thunk](https://github.com/gaearon/redux-thunk#installation)

### Setup

```bash
npm install react-quest --save
```

Then add the react-quest reducer to your root reducer:

```js
import { reducer as questReducer } from 'react-quest';

const reducer = combineReducers({
  _data_: questReducer
});
```

### Server side resolution

To server render an app that is complete with data, quests must first be resolved before their components are rendered. This means we need to reach beyond synchronous rendering solutions, like `ReactDOMServer.renderToString()`, and to a renderer that can render the tree progressively. Custom renderers are super hot right now and excellent renderers like rapscallion are [shaping up to solve this problem](https://github.com/FormidableLabs/rapscallion/issues/51#issuecomment-287202896).

While the React community figures out progessive rendering you can try [redux-ready](https://github.com/djgrant/redux-ready), a simple solution that works well with simple trees that don't have nested quests, or [react-warmup](https://github.com/djgrant/react-warmup) which performs a cache warmup.

### Creating resolvers

Every quest must have a resolver. The resolver's job is to return some data or a promise that resolves with some data. A typical resolver might fetch some data from an API.

Every resolver must include a `key` and a `get()` method.

```js
const postsResolver = {
  key: 'posts',
  get() {
    return fetch(POST_API_URL).then(r => r.json())
  }
};
```

In this example the resolved data will be keyed against a `posts` field in the redux store:

```js
{
  _data_: {
    posts: {
      loading: false,
      complete: true,
      error: null,
      data: { ... }
    }
  }
}
```

To use the resolver, provide it as an option in a quest:

```js
const withPosts = quest({
  resolver: postsResolver
});

const Items = ({ posts }) => (
  <div>
    {posts.data
      ? posts.data.map(post => <Item entry={post} />)
      : <Loading />
    }
  </div>
);

export default withPosts(Items);
```

This creates a quest object that is set on the components props under the resolver's key name:

```js
Items.propTypes = {
  posts: PropType.shape({
    data: PropType.any,
    error: PropType.string,
    loading: PropType.boolean,
    complete: PropType.boolean,
    get: PropType.function
  })
};
```

> A resolver can be re-used in multiple quests without causing additional fetching or duplication in the store.

### Calling resolver methods programmatically

You can add as many methods to a resolver as you would like. The default `get()` method is called as part of the quest's lifecyle. Additional methods can be called directly via props.

Every method in a resolver is added to the quest object for direct access. Take the following example:

```js
const postsResolver = {
  key: 'posts',
  get() {
    return fetch(POST_API_URL).then(r => r.json())
  },
  create() {
    // perform a mutation
  }
};

quest({
  resolver: postsResolver
})(Posts)
```

Both the get and create methods are added to the quest object's properties:

```js
Posts.propTypes = {
  posts: PropType.shape({
    get: PropType.function,  // <--
    create: PropType.function, // <--
    data: PropType.any,
    error: PropType.string,
    loading: PropType.boolean,
    complete: PropType.boolean
  })
};
```

Being able to call methods programmatically enables you to update your local dataset or mutate remote data. For example, the `create()` method could be called on a user event (see [Passing a query to the resolver](#passing-a-query-to-the-resolver)), and the `get()` method could be used to implement pagination or lazy loading.

### Deferring fetching to the browser
By default quests will attempt to resolve their data requirements whenever they are instantiated, including on server render passes. To defer loading until the component is mounted set `fetchOnServer: false` in the options block:

```js
quest({
  resolver: postsResolver,
  fetchOnServer: false
});
```

### Fetching data on prop changes

To defer loading until a condition in the component's props is satisfied provide a predicate function to the `fetchOnce` option:

```js
quest({
  resolver: postsResolver,
  fetchOnce: props => props.ready
})
```

To refetch a resource when a new condition is satisfied while a component is receiving new props, pass a predicate function to the `fetchWhen` option:

```js
quest({
  resolver: postsResolver,
  refetchWhen: (props, nextProps) => props.a !== nextProps.a
})
```

### Transforming resolved data

A common requirement when working with remote data sources is to be able to transform the dataset set once it has been resolved. Developers are encouraged to write functions (known as selectors in Redux land) that transform the resolved data into a new dataset. You can pass a selector function to the `mapData` option and react-quest will take care of mapping the data once it arrives.

```js
const withPostTitles = quest({
  resolver: postsResolver,
  fetchOnServer: false,
  mapData: posts => posts.map(post => {
    id: post.slug,
    title: sentenceCase(posts.title)
  })
});

const PostList = ({ posts }) => (
  <div>
    {posts.data
      ? (
        <ul>
          {posts.data.map(post =>
            <li id={post.id} key={post.id}>{post.title}</li>
          )}
        </ul>
      ) : (
        <Loading />
      )
    }
  </div>
);

export default withPostTitles(PostList);
```

### Mapping data to props

You can map data directly to a component's props. This is handy if you find yourself wanting to apply multiple selectors to the same dataset.

`mapToProps` takes a prop mapping function that maps the resolved dataset to a props object. The created props object is then spread into the components own props.

```js
const withNewPosts = quest({
  resolver: postsResolver,
  mapToProps: posts => ({
    newPosts: posts.filter(post => post.isNew),
    otherPosts: getOtherPostsSelector
  })
});

const Items = ({ posts, newPosts }) => (
  {posts.completed &&
    <div>{newPosts.data.map(post => <Item entry={post} />)}</div>}
);

export default withNewPosts(Items);
```

<!-- Not sure about including this as a documented feature yet
**Map data directly to props**
You can also pass a boolean `true` to mapToProps, which maps all the data directly to `props[resolverKey]`.

```js
const withPosts = quest({
  resolver: postsResolver,
  mapToProps: true
});

const Items = ({ posts }) => (
  <div>{posts.data.map(post => <Item entry={post} />)}</div>
);

export default withNewPosts(Items);
```

> ⚠️️ Only ever use `mapToProps: true` if you are certain the data will be resolved synchronously and you don't need to mutate it
-->

### Passing a query to the resolver

Queries are a powerful construct that enable you to change the way data is resolved. Queries are passed as a parameter to resolver methods. A `query` can be either a prop mapping function or a plain object:

```js
const postsResolver = {
  key: 'posts',
  get(query) {
    const filter = query.filter;
    return fetch(`${POST_API_URL}?filter=${filter}`).then(r => r.json())
  }
};

quest({
  resolver: postsResolver,
  query: {
    filter: myStaticFilter
  }
});
```

Queries can be paired nicely with react-redux's `connect` HOC:

```js
compose(
  connect(state => ({
    filter: getPostsFilter(state)
  })),
  quest({
    resolver: postsResolver,
    query: props => ({
      filter: props.filter
    })
  })
);
```

Queries can also be passed to resolver methods when they are called programmatically.

```js
class extends Component {
  handleClick(event) {
    const query = { title: event.target.value };
    this.props.posts.create(query);
  }
}
```

### Adding mutation methods to resolvers
Now that we know how to pass queries into resolvers and how to access resolver methods programmatically, we can add some mutative methods to our `postsResolver`. Let's add a method that creates new entries.

```js
const postsResolver = {
  ...
  create(post) {
    fetch(POST_API_URL, {
      method: 'POST',
      body: JSON.stringify(post)
    });
  }
};
```

To use this method, in we would call it from a handler in the component:

```js
class NewPost extends Component {
  handleSubmit(e) {
    const post = e.data;
    this.props.posts.create(post);
  }
  render() {
    return <button onClick={this.handleSubmit}>New Post</button>
  }
}

export default quest({ resolver: postsResolver })(NewPost);
```

### Updating remote data

Calling the create method in the previous example creates a new post on the server but we still need to display the post that the user created in the UI.

To update the local data store, return a promise that resolves with updated collection from the resolver's mutation method:

```js
const postsResolver = {
  ...
  create(post) {
    return fetch(POST_API_URL, {
      method: 'POST',
      body: JSON.stringify(post)
    })
      .then(response => {
        // once the server has created the new post
        // get the latest collection of posts again
        if (response.status === 201) {
          // send another GET request and return a promise
          // that resolves with the final data
          return postsResolver.get();
        }        
      });
  }
};

class NewPost extends Component {
  handleSubmit(e) {
    const post = e.data;
    this.props.posts.create(post);
  }
  render() {
    return <button onClick={this.handleSubmit}>New Post</button>
  }
}

export default quest({ resolver: postsResolver })(NewPost);
```

In the above example we execute a second request to the API to fetch the updated resource. If however the response body of the POST request contains the complete updated collection of posts we could resolve the promise with that data instead, saving an extra round trip to the API:

```js
const postsResolver = {
  ...
  create(post) {
    return fetch(POST_API_URL, {
      method: 'POST',
      body: JSON.stringify(post)
    }).then(r => r.json());
  }
};
```

There are times when in order to form a complete update you'll need access to the data in the local store (say, for example, if your server responds with just the created resource and you need to add it to the existing collection).

When getting existing data it is important to ensure that your update is dispatched immediately after to avoid the data you retrieved going stale.  This means you must pull the latest data out of the store and in the same tick of the event loop dispatch your update. To do this wrap your update (promise) in a thunk, which takes a `dispatch` and `getCurrentData` function. This approach allows react-quest to turn control of dispatching updates over to the resolver (and you, the developer), to guarantee that you only ever update the store with the latest data.

For more details on why this is necessary see https://github.com/djgrant/react-quest/pull/4.

```js
const postsResolver = {
  ...
  create: post => (dispatch, getCurrentPosts) => {
    return fetch(POST_API_URL, {
      method: 'POST',
      body: JSON.stringify(post)
    })
      .then(r => r.json())
      .then(newPost => dispatch.update([...getCurrentPosts(), newPost]));
  }
};
```

### Performing optimistic updates

Suppose we want to immediately update the local data store, even before it has been created on the server? We can perform an optimistic update by, instead of returning a single promise from our mutation handler, returning _an array_ of promises. Each promise represents an update task and the local data store is updated with the result of each promise as it resolves. As a fail safe mechanism, if any of the promises reject then all updates are reverted.

As a fail safe mechanism, if a promise rejects, any updates from promises that were resolved prior in the cycle will get reverted.

Let's start with a simple example for this technique:

```js
const numberResolver = {
  ...
  create(number) {
    // the first promise will resolve with the data we hope to add
    const optimisticUpdate = Promise.resolve(number);

    // the second promise will resolve with the actual data
    const serverUpdate = new Promise(resolve => {
      // mock an IO operation
      setTimeout(() => {
        resolve(2);
      }, 100);
    });

    // return both promises in an array
    return [optimisticUpdate, serverUpdate]
  }
}

```

In this example the local store is first updated with `number` and then 100ms later it is updated with `2`.

Returning to our posts example, we can update the local store first with the user input using a promise that immediately resolves (the optimistic update), and then with the real data from the server. To add just a little extra complexity to the example, let's also handle cases where the server update fails. In such an event, we'd need to revert the effect of the optimistic update and resolve the server update with the original posts collection.

```js
const postsResolver = {
  ...
  create: post => (dispatch, getCurrentPosts) => {
    const optimisticUpdate = Promise.resolve(newPosts);

    const serverUpdate = fetch(POST_API_URL, {
      method: 'POST',
      body: JSON.stringify(post)
    })
      .then(response => {
        if (response.status !== 201) {
          // our optimism didn't pay off this time as
          // the resource wasn't created on the server
          // resolve this promise with the original data to revert the first update
          return currentPosts;
        }
        return response.json();
      })
      .then(newPost => dispatch.update([...getCurrentPosts(), newPost]))
      .catch(err => {
        console.log('Create post failed with error ', err)
        // If the promise rejects the fail safe mechanism
        // will revert all previous updates in this cycle
      });

    return [optimisticUpdate, serverUpdate];
  }
};
```

## Credits

react-quest was inspired by a few projects in particular:
- [Relay](https://facebook.github.io/relay/), which introduced the idea of colocating data queries and components
- [Apollo](http://dev.apollodata.com/), whose React client proved the versatility of redux as a local cache
- [react-jobs](https://github.com/ctrlplusb/react-jobs), which influenced the design of the quest higher order components
