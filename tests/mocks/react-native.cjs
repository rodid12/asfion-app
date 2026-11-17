const React = require('react');

const host = name => React.forwardRef(({ children, ...props }, ref) =>
  React.createElement(name, { ...props, ref }, children));

const View = host('View');
const Text = host('Text');
const Pressable = host('Pressable');
const ScrollView = host('ScrollView');
const TextInput = host('TextInput');
const ActivityIndicator = host('ActivityIndicator');
const KeyboardAvoidingView = host('KeyboardAvoidingView');

const FlatList = React.forwardRef(({
  data = [],
  renderItem,
  ListEmptyComponent,
  ...props
}, ref) => React.createElement(
  'FlatList',
  { ...props, ref },
  data.length > 0
    ? data.map((item, index) => React.createElement(
        React.Fragment,
        { key: item?.id ?? index },
        renderItem({ item, index }),
      ))
    : (typeof ListEmptyComponent === 'function'
        ? React.createElement(ListEmptyComponent)
        : ListEmptyComponent),
));

const Modal = ({ children, visible = true, ...props }) => visible
  ? React.createElement('Modal', props, children)
  : null;

const StyleSheet = {
  create: value => value,
  flatten: value => Array.isArray(value) ? Object.assign({}, ...value.filter(Boolean)) : value,
  compose: (a, b) => [a, b],
  absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  absoluteFillObject: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  hairlineWidth: 1,
};

module.exports = {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  FlatList,
  Modal,
  RefreshControl: host('RefreshControl'),
  Alert: { alert: jest.fn() },
  AppState: {
    currentState: 'active',
    addEventListener: () => ({ remove: () => undefined }),
  },
  Platform: { OS: 'ios', select: values => values.ios ?? values.default },
  StyleSheet,
  Dimensions: { get: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }) },
  PixelRatio: { get: () => 3, roundToNearestPixel: value => value },
  I18nManager: { isRTL: false },
};
