import React, { Component } from 'react';
import { Button, InputGroup, InputGroupAddon, InputGroupText, Input } from 'reactstrap';

import Downshift, { ControllerStateAndHelpers } from 'downshift';
import sanitizeHTML from 'sanitize-html';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faSpinner, faGlobeEurope } from '@fortawesome/free-solid-svg-icons';
import MetricsExplorer from './MetricsExplorer';
import { Fuzzy, FuzzyResult } from '@nexucis/fuzzy';

interface ExpressionInputProps {
  value: string;
  onExpressionChange: (expr: string) => void;
  queryHistory: string[];
  metricNames: string[];
  executeQuery: () => void;
  loading: boolean;
  enableAutocomplete: boolean;
}

interface ExpressionInputState {
  height: number | string;
  showMetricsExplorer: boolean;
}

const fuz = new Fuzzy({ pre: '<strong>', post: '</strong>', shouldSort: true });

class ExpressionInput extends Component<ExpressionInputProps, ExpressionInputState> {
  private exprInputRef = React.createRef<HTMLInputElement>();

  constructor(props: ExpressionInputProps) {
    super(props);
    this.state = {
      height: 'auto',
      showMetricsExplorer: false,
    };
  }

  componentDidMount(): void {
    this.setHeight();
  }

  setHeight = (): void => {
    const { offsetHeight, clientHeight, scrollHeight } = this.exprInputRef.current!;
    const offset = offsetHeight - clientHeight; // Needed in order for the height to be more accurate.
    this.setState({ height: scrollHeight + offset });
  };

  handleInput = (): void => {
    this.setValue(this.exprInputRef.current!.value);
  };

  setValue = (value: string): void => {
    const { onExpressionChange } = this.props;
    onExpressionChange(value);
    this.setState({ height: 'auto' }, this.setHeight);
  };

  componentDidUpdate(prevProps: ExpressionInputProps): void {
    const { value } = this.props;
    if (value !== prevProps.value) {
      this.setValue(value);
    }
  }

  handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    const { executeQuery } = this.props;
    if (event.key === 'Enter' && !event.shiftKey) {
      executeQuery();
      event.preventDefault();
    }
  };

  getSearchMatches = (input: string, expressions: string[]): FuzzyResult[] => {
    return fuz.filter(input.replace(/ /g, ''), expressions);
  };

  createAutocompleteSection = (downshift: ControllerStateAndHelpers<any>) => {
    const { inputValue = '', closeMenu, highlightedIndex } = downshift;
    const autocompleteSections = {
      'Query History': this.props.queryHistory,
      'Metric Names': this.props.metricNames,
    };
    let index = 0;
    const sections =
      inputValue?.length && this.props.enableAutocomplete
        ? Object.entries(autocompleteSections).reduce((acc, [title, items]) => {
            const matches = this.getSearchMatches(inputValue, items);
            return !matches.length
              ? acc
              : [
                  ...acc,
                  <ul className="autosuggest-dropdown-list" key={title}>
                    <li className="autosuggest-dropdown-header">{title}</li>
                    {matches
                      .slice(0, 100) // Limit DOM rendering to 100 results, as DOM rendering is sloooow.
                      .map((result: FuzzyResult) => {
                        const itemProps = downshift.getItemProps({
                          key: result.original,
                          index,
                          item: result.original,
                          style: {
                            backgroundColor: highlightedIndex === index++ ? 'lightgray' : 'white',
                          },
                        });
                        return (
                          <li
                            key={title}
                            {...itemProps}
                            dangerouslySetInnerHTML={{ __html: sanitizeHTML(result.rendered, { allowedTags: ['strong'] }) }}
                          />
                        );
                      })}
                  </ul>,
                ];
          }, [] as JSX.Element[])
        : [];

    if (!sections.length) {
      // This is ugly but is needed in order to sync state updates.
      // This way we force downshift to wait React render call to complete before closeMenu to be triggered.
      setTimeout(closeMenu);
      return null;
    }

    return (
      <div {...downshift.getMenuProps()} className="autosuggest-dropdown">
        {sections}
      </div>
    );
  };

  openMetricsExplorer = (): void => {
    this.setState({
      showMetricsExplorer: true,
    });
  };

  updateShowMetricsExplorer = (show: boolean): void => {
    this.setState({
      showMetricsExplorer: show,
    });
  };

  insertAtCursor = (value: string): void => {
    if (!this.exprInputRef.current) return;

    const startPosition = this.exprInputRef.current.selectionStart;
    const endPosition = this.exprInputRef.current.selectionEnd;

    const previousValue = this.exprInputRef.current.value;
    let newValue: string;
    if (startPosition && endPosition) {
      newValue =
        previousValue.substring(0, startPosition) + value + previousValue.substring(endPosition, previousValue.length);
    } else {
      newValue = previousValue + value;
    }

    this.setValue(newValue);
  };

  render() {
    const { executeQuery, value } = this.props;
    const { height } = this.state;
    return (
      <>
        <Downshift onSelect={this.setValue}>
          {(downshift) => (
            <div>
              <InputGroup className="expression-input">
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>
                    {this.props.loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSearch} />}
                  </InputGroupText>
                </InputGroupAddon>
                <Input
                  onInput={this.handleInput}
                  style={{ height }}
                  autoFocus
                  type="textarea"
                  rows="1"
                  onKeyPress={this.handleKeyPress}
                  placeholder="Expression (press Shift+Enter for newlines)"
                  innerRef={this.exprInputRef}
                  {...downshift.getInputProps({
                    onKeyDown: (event: React.KeyboardEvent): void => {
                      switch (event.key) {
                        case 'Home':
                        case 'End':
                          // We want to be able to jump to the beginning/end of the input field.
                          // By default, Downshift otherwise jumps to the first/last suggestion item instead.
                          (event.nativeEvent as any).preventDownshiftDefault = true;
                          break;
                        case 'ArrowUp':
                        case 'ArrowDown':
                          if (!downshift.isOpen) {
                            (event.nativeEvent as any).preventDownshiftDefault = true;
                          }
                          break;
                        case 'Enter':
                          downshift.closeMenu();
                          break;
                        case 'Escape':
                          if (!downshift.isOpen) {
                            this.exprInputRef.current!.blur();
                          }
                          break;
                        default:
                      }
                    },
                  } as any)}
                  value={value}
                />
                <InputGroupAddon addonType="append">
                  <Button className="metrics-explorer-btn" title="Open metrics explorer" onClick={this.openMetricsExplorer}>
                    <FontAwesomeIcon icon={faGlobeEurope} />
                  </Button>
                </InputGroupAddon>
                <InputGroupAddon addonType="append">
                  <Button className="execute-btn" color="primary" onClick={executeQuery}>
                    Execute
                  </Button>
                </InputGroupAddon>
              </InputGroup>
              {downshift.isOpen && this.createAutocompleteSection(downshift)}
            </div>
          )}
        </Downshift>

        <MetricsExplorer
          show={this.state.showMetricsExplorer}
          updateShow={this.updateShowMetricsExplorer}
          metrics={this.props.metricNames}
          insertAtCursor={this.insertAtCursor}
        />
      </>
    );
  }
}

export default ExpressionInput;
