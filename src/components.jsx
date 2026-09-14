import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';

// Adapted from float_ui's 21st.dev Radix tabs example for controlled rankings.
export function BoardTabs({value,onChange,items,label}) {
  return <Tabs.Root value={value} onValueChange={onChange}><Tabs.List className="board-tabs" aria-label={label}>{items.map(x=><Tabs.Trigger key={x.id} value={x.id} className="board-tab">{x.label}</Tabs.Trigger>)}</Tabs.List></Tabs.Root>;
}

// Adapted from HextaUI's 21st.dev clearable icon input usage.
export function SearchInput({value,onChange,label,placeholder,clearLabel}) {
  return <div className="field"><label htmlFor="repo-search">{label}</label><div className="search-wrap"><span aria-hidden="true">⌕</span><input id="repo-search" type="search" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>{value&&<button type="button" className="clear-button" aria-label={clearLabel} onClick={()=>onChange('')}>×</button>}</div></div>;
}

const emptyValue='__github_pulse_empty__';
export function DesignSelect({id,value,onChange,options,ariaLabel}) {
  const selected=String(value??'')||emptyValue;
  return <Select.Root value={selected} onValueChange={next=>onChange(next===emptyValue?'':next)}>
    <Select.Trigger id={id} className="design-select-trigger" aria-label={ariaLabel}>
      <Select.Value/>
      <Select.Icon className="design-select-chevron" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="m4 7 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></Select.Icon>
    </Select.Trigger>
    <Select.Portal><Select.Content className="design-select-content" position="popper" sideOffset={7} collisionPadding={12} align="start"><Select.Viewport className="design-select-viewport">
      {options.map(option=>{const optionValue=String(option.value??'')||emptyValue;return <Select.Item key={optionValue} value={optionValue} className="design-select-item"><Select.ItemText>{option.label}</Select.ItemText><Select.ItemIndicator className="design-select-check" aria-hidden="true">✓</Select.ItemIndicator></Select.Item>})}
    </Select.Viewport></Select.Content></Select.Portal>
  </Select.Root>;
}

// Adapted from float_ui's 21st.dev Radix newsletter dialog; content is GitHub Pulse's own form.
export function SubscribeDialog({trigger,title,description,children}) {
  return <Dialog.Root><Dialog.Trigger asChild>{trigger}</Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-content"><Dialog.Close className="dialog-close" aria-label={document.documentElement.lang==='zh'?'关闭':'Close'}>×</Dialog.Close><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
