import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full min-h-[200px]">
          <div className="text-center p-6 max-w-md">
            <svg className="w-10 h-10 mx-auto mb-3 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <h3 className="text-sm font-semibold text-soc-text dark:text-soc-darktext mb-1">
              {this.props.title || 'Something went wrong'}
            </h3>
            <p className="text-[11px] text-soc-stext/60 dark:text-soc-darkstext/60 mb-3">
              {this.props.message || 'An unexpected error occurred. Please try again.'}
            </p>
            <div className="text-[9px] font-mono text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded mb-3 max-h-20 overflow-auto">
              {this.state.error?.message || 'Unknown error'}
            </div>
            <button onClick={() => this.setState({ hasError: false, error: null })}
              className="px-3 py-1.5 text-[10px] font-medium rounded-md bg-[#EF843C] text-white hover:bg-[#d4661e] dark:bg-[#EF843C] dark:text-[#1a1d27] transition-all">
              Try Again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
