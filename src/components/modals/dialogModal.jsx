import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { withStyles } from '@material-ui/core/styles'
import { Button, Dialog, DialogTitle, DialogActions, DialogContent } from '@material-ui/core'
import CircularProgress from '@material-ui/core/CircularProgress'
import { makeStyles } from '@material-ui/core';
import { TextField } from '@material-ui/core';
import { useTranslation } from "react-i18next";
// import { InputAdornment } from '@material-ui/core';
// import Clear from '@material-ui/icons/Clear';

const ANCHORID = 'dialogAnchor';

const styles = { root: { marginLeft: 5 } }
const SpinnerAdornment = withStyles(styles)(props => (
   <CircularProgress
     className={props.classes.spinner}
     size={20}
   />
))

const useStyles = makeStyles((theme) => ({
  root: {
    position: 'fixed',
    bottom: theme.spacing(2),
    right: theme.spacing(2),
  },
  loadSpreadsheet: {
    marginBottom: '2em',
  },
  sheetFilter: {
    marginBottom: '1em',
    width: '10em',
  },
}));

export const dialogModal = function() {
   let fx = {};

   fx.inform = ({message, icon, title, okAction}) => {
      let buttons = [ { label: 'ok', intent: 'success', onClick: okAction } ];
      let content = <h2 className='bp3-heading'> {message} </h2>;
      fx.open({ icon: icon || 'help', title: title || 'Action', content, buttons })
   };

   fx.confirm = ({query, okAction, cancelAction}) => {

      // label must be t() value for translations
      let buttons = [
         { label: 'OK', intent: 'success', loading: false, onClick: okAction },
         { label: 'Close', intent: 'primary', onClick: cancelAction }
      ];
      let content = <h2 className='bp3-heading'> {query} </h2>;
      fx.open({ icon: 'help', title: 'Action', content, buttons })
   };

   fx.open = ({icon, title, content, buttons, escapeClose, outsideClickClose, heading, onRender}={}) => {
      let anchor = getAnchor();
      buttons = buttons || [{ label: 'Close', intent: 'primary' }];
      if (heading) content = <h2 className='bp3-heading'>{content}</h2>;
      if (anchor) {
         ReactDOM.render(
            <TmxDialog
               icon={icon}
               title={title}
               content={content}
               buttons={buttons}
               onRender={onRender}
               escapeClose={escapeClose}
               outsideClickClose={outsideClickClose}
            />
         , anchor);
      }
   }

   function TmxButton(i) {
      const { t } = useTranslation();

      return (
         <Button
            key={t(`buttons.${i.label}`)}
            icon={i && i.icon}
            href={i && i.href}
            intent={(i && i.intent) || ''}
            className={(i && i.className) || ''}
            onClick={clickAction}
         >
            {!i.loading && t(`buttons.${i.label}`)}
            {i.loading && <SpinnerAdornment />}
         </Button>
      )

      function clickAction() {
         if (i && i.onClick && typeof i.onClick === 'function') {
            i.onClick();
            if (!i.preventDefault) fx.close();
         } else {
            fx.close();
         }
      }
   }

   function TmxButtons(props) {
      return (props.buttons || []).map(TmxButton).filter(f=>f);
   }

   function TmxButtonGroup(props){
      let { buttons, title } = props;
      if (!props.buttons || !props.buttons.length) {
         return ( <div/>)
      } else {
         return (
            <DialogActions>
               <TmxButtons key={title} buttons={buttons} />
            </DialogActions>
         )
      }
   }

   function TmxDialog(props) {
      const classes = useStyles();
      const { t } = useTranslation();

      const filterValueStorage = 'xlsxSheetFilter';
      const filterChanged = evt => localStorage.setItem(filterValueStorage, evt.target.value);

      useEffect(() => { if (props.onRender) props.onRender(); });

      return (
         <Dialog
            open={true}
            icon={props.icon}
            onClose={fx.close}
            title={props.title}
            autoFocus={true}
            className={props.className}
         >
            <DialogTitle>
               <TextField
                   onChange={filterChanged}
                   defaultValue={localStorage.getItem(filterValueStorage)}
                   className={classes.sheetFilter}
                   placeholder={t("Sheet Filter")}
                   label={t("Sheet Filter")}
               />
            </DialogTitle>
            <DialogContent>
               {props.content}
            </DialogContent>
            <TmxButtonGroup buttons={props.buttons} title={props.title} />
         </Dialog>
      );
   }

   fx.close = () => {
      let anchor = document.getElementById(ANCHORID);
      if (anchor) { ReactDOM.unmountComponentAtNode(anchor); }
   };

   function getAnchor() {
      let anchor = document.getElementById(ANCHORID);

      if (!anchor) {
         let el = document.createElement('div');
         el.setAttribute('id', ANCHORID);
         el.setAttribute('style', 'position: absolute;');
         document.body.appendChild(el);
         anchor = document.getElementById(ANCHORID);
      }

      return anchor;
   }

   return fx;
}();