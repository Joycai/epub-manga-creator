import React, { FormEvent, useCallback, useContext, useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import { toJS } from 'mobx';
import { StoreContext } from 'store/main';
import Icon from 'components/icon';
import { useI18n } from 'i18n';

const KeywordPicker = function(props: { keywords: string[], onClick: (str: string) => void }) {
  const onClick = useCallback((e: FormEvent<HTMLButtonElement>) => {
    const index = e.currentTarget.dataset.index as string;
    props.onClick(props.keywords[+index]);
  }, [props]);

  return (
    <>
      {
        props.keywords.map((str, index) =>
          <button
            type="button"
            key={index}
            data-index={index}
            className="btn btn-outline-primary btn-sm me-2"
            onClick={onClick}
          >{str}</button>
        )
      }
    </>
  );
};

const ModalBook = observer(function() {
  const { ui: storeUI, book: storeBook } = useContext(StoreContext);
  const t = useI18n();
  const setsSeletRef = React.useRef<HTMLSelectElement>(null);

  const [fileName, setFileName] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedSetIndex, setSelectedSetIndex] = useState(-1);

  const keywordsLength = keywords.length;

  const onClickModal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    return;
  }, []);
  const onClickClose = useCallback(() => {
    storeUI.toggleBookVisible();
  }, [storeUI]);

  const onClickAnalyze = useCallback(() => {
    const reg = [
      /\[.*?\(.*\)\]/, // [xxx(xxx)]
      /\[.*?\]\s?\[.*?\]/, // [xxx][xxx]
      /\[.*?\]/, // [xxx]
      /\(.*?\)/, // (xxx)
      /\([^[\]()]*?\)|\[[^[\]()]*?\]/g,
    ];

    let suffix0 = reg[0].exec(fileName);
    let suffix1 = reg[1].exec(fileName);
    let suffix2 = reg[2].exec(fileName);
    let suffix3 = reg[3].exec(fileName);

    if (suffix0) {
      let suffix = suffix0[0];
      let author = Array.from(suffix.match(/\(.*?\)/g) || []).pop();
      const i = fileName.indexOf(suffix);
      const titleAndPrefix = fileName.slice(i === 0 ? suffix.length : i + suffix.length).trim();

      storeBook.updateBookPageProperty('bookTitle', titleAndPrefix);
      storeBook.updateBookPageProperty('bookAuthors', [author?.slice(1, -1)?.trim() || '']);
      setKeywords(Array.from(fileName.match(reg[4]) || []).map(str => str.slice(1, -1)));
      return;
    }

    if (suffix1) {
      let suffix = suffix1[0];
      let author = Array.from(suffix.match(/\[.*?\]/g) || []).pop();
      const i = fileName.indexOf(suffix);
      const titleAndPrefix = fileName.slice(i === 0 ? suffix.length : i + suffix.length).trim();

      storeBook.updateBookPageProperty('bookTitle', titleAndPrefix);
      storeBook.updateBookPageProperty('bookAuthors', [author?.slice(1, -1)?.trim() || '']);
      setKeywords(Array.from(fileName.match(reg[4]) || []).map(str => str.slice(1, -1)));
      return;
    }

    if (suffix2) {
      let suffix = suffix2[0];
      let author = suffix.slice(1, -1);
      const i = fileName.indexOf(suffix);
      const titleAndPrefix = fileName.slice(i === 0 ? suffix.length : i + suffix.length).trim();

      storeBook.updateBookPageProperty('bookTitle', titleAndPrefix);
      storeBook.updateBookPageProperty('bookAuthors', [author]);
      setKeywords(Array.from(fileName.match(reg[4]) || []).map(str => str.slice(1, -1)));
      return;
    }

    if (suffix3) {
      let suffix = suffix3[0];
      let author = suffix.slice(1, -1);
      const i = fileName.indexOf(suffix);
      const titleAndPrefix = fileName.slice(i === 0 ? suffix.length : i + suffix.length).trim();

      storeBook.updateBookPageProperty('bookTitle', titleAndPrefix);
      storeBook.updateBookPageProperty('bookAuthors', [author]);
      setKeywords(Array.from(fileName.match(reg[4]) || []).map(str => str.slice(1, -1)));
      return;
    }

    storeBook.updateBookPageProperty('bookTitle', fileName);
    setKeywords(Array.from(fileName.match(reg[4]) || []).map(str => str.slice(1, -1)));
  }, [storeBook, fileName]);

  const onChangeFileName = useCallback((e: FormEvent<HTMLInputElement>) => {
    setFileName(e.currentTarget.value);
  }, []);
  const onChangeBookID = useCallback((e: FormEvent) => {
    const eventTarget = e.currentTarget as HTMLInputElement;
    storeBook.updateBookPageProperty('bookID', eventTarget.value);
  }, [storeBook]);
  const onChangeBookTitle = useCallback((e: FormEvent<HTMLInputElement>) => {
    storeBook.updateBookPageProperty('bookTitle', e.currentTarget.value);
  }, [storeBook]);
  const onAddAuthor = useCallback((e: FormEvent) => {
    const eventTarget = e.currentTarget as HTMLInputElement;
    const index = eventTarget.dataset.index as string;
    const newValue = [...toJS(storeBook.bookAuthors)];
    newValue.splice(+index, 1, newValue[+index], '');
    storeBook.updateBookPageProperty('bookAuthors', newValue);
  }, [storeBook]);
  const onRemoveAuthor = useCallback((e: FormEvent) => {
    const eventTarget = e.currentTarget as HTMLInputElement;
    const index = eventTarget.dataset.index as string;
    const newValue = [...toJS(storeBook.bookAuthors)];
    newValue.splice(+index, 1);
    storeBook.updateBookPageProperty('bookAuthors', newValue);
  }, [storeBook]);
  const onChangeBookAuthors = useCallback((e: FormEvent) => {
    const eventTarget = e.currentTarget as HTMLInputElement;
    const index = eventTarget.dataset.index as string;
    const newValue = [...toJS(storeBook.bookAuthors)];
    newValue.splice(+index, 1, eventTarget.value);
    storeBook.updateBookPageProperty('bookAuthors', newValue);
  }, [storeBook]);
  const onChangeBookSubject = useCallback((e: FormEvent) => {
    const eventTarget = e.currentTarget as HTMLInputElement;
    storeBook.updateBookPageProperty('bookSubject', eventTarget.value);
  }, [storeBook]);
  const onChangeBookPublisher = useCallback((e: FormEvent) => {
    const eventTarget = e.currentTarget as HTMLInputElement;
    storeBook.updateBookPageProperty('bookPublisher', eventTarget.value);
  }, [storeBook]);
  const onChangeBookLanguage = useCallback((e: FormEvent<HTMLInputElement>) => {
    storeBook.updateBookPageProperty('bookLanguage', e.currentTarget.value);
  }, [storeBook]);

  const onChangeTitleFromPicker = useCallback((value: string) => {
    storeBook.updateBookPageProperty('bookTitle', value);
  }, [storeBook]);
  const onChangeAuthorsFromPicker = useCallback((value: string) => {
    const authors = toJS(storeBook.bookAuthors);

    if (authors.slice(-1)[0] === '') {
      authors[authors.length - 1] = value;
    } else {
      authors.push(value);
    }

    storeBook.updateBookPageProperty('bookAuthors', authors);
  }, [storeBook]);
  const onChangePublisherFromPicker = useCallback((value: string) => {
    storeBook.updateBookPageProperty('bookPublisher', value);
  }, [storeBook]);

  const onClickModalBody = useCallback(() => {
    setSelectedSetIndex(-1);
  }, []);

  const onClickSaveSet = useCallback(() => {
    storeBook.saveBookInfoToSet();
    setSelectedSetIndex(-1);
    setTimeout(() => {
      if (setsSeletRef.current) {
        setsSeletRef.current.value = '-1';
      }
    }, 0);
  }, [storeBook]);

  const onClickRemoveSet = useCallback(() => {
    storeBook.removeBookInfoSet(selectedSetIndex);
    setSelectedSetIndex(-1);
    setTimeout(() => {
      if (setsSeletRef.current) {
        setsSeletRef.current.value = '-1';
      }
    }, 0);
  }, [selectedSetIndex, storeBook]);

  const onApplySet = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const index = +e.currentTarget.value;
    setSelectedSetIndex(index);
    storeBook.applySet(index);
  }, [storeBook]);

  useEffect(() => {
    setFileName(storeUI.fileName);
  }, [storeUI.fileName]);

  useEffect(() => {
    if (fileName && storeUI.firstImport) {
      onClickAnalyze();
      storeUI.firstUploaded();
    }
  }, [fileName, onClickAnalyze, storeUI]);

  useEffect(() => {
    if (selectedSetIndex !== -1) {
      return;
    }
    setTimeout(() => {
      if (setsSeletRef.current) {
        setsSeletRef.current.value = selectedSetIndex + '';
      }
    }, 0);
  });

  return (
    <div className="modal-dialog modal-lg" onClick={onClickModal}>
      <div className="modal-content">
        <div className="modal-header">
          <h5 className="modal-title">{t.book.modalTitle}</h5>
          <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={onClickClose}></button>
        </div>
        <div className="modal-body" onClick={onClickModalBody}>
          <div className="mb-3 row">
            <label htmlFor="input-filename" className="col-sm-2 col-form-label text-end">{t.book.filename}</label>
            <div className="col-sm-10">
              <div className="input-group">
                <input type="text" className="form-control" id="input-filename" value={fileName} onInput={onChangeFileName}/>
                <button
                  className="btn btn-outline-secondary d-flex justify-content-center align-items-center"
                  type="button"
                  onClick={onClickAnalyze}
                >
                  <Icon name="rocket"></Icon>
                </button>
              </div>
            </div>
          </div>
          <div className="mb-3 row">
            <label htmlFor="input-book-id" className="col-sm-2 col-form-label text-end">{t.book.id}</label>
            <div className="col-sm-10">
              <input type="text" className="form-control" id="input-book-id" value={storeBook.bookID} onInput={onChangeBookID}/>
            </div>
          </div>
          <div className="mb-3 row">
            <label htmlFor="input-book-title" className="col-sm-2 col-form-label text-end">{t.book.title}</label>
            <div className="col-sm-10">
              <input type="text" className="form-control" id="input-book-title" value={storeBook.bookTitle} onInput={onChangeBookTitle}/>
              <div className={keywordsLength ? "mt-3" : ''}>
                <KeywordPicker keywords={keywords} onClick={onChangeTitleFromPicker}/>
              </div>
            </div>
          </div>
          <div className="mb-3 row">
            <label htmlFor="input-book-author" className="col-sm-2 col-form-label text-end">{t.book.author}</label>
            <div className="col-sm-10">
              {
                storeBook.bookAuthors.map((name: string, index: number) => (
                  <div key={index} className={"input-group" + ((index + 1) === storeBook.bookAuthors.length ? '' : ' mb-3')}>
                    <input type="text" className="form-control" data-index={index} value={name} onInput={onChangeBookAuthors}/>
                    <button
                      className="btn btn-outline-secondary d-flex justify-content-center align-items-center"
                      type="button"
                      data-index={index}
                      onClick={onAddAuthor}
                    >
                      <Icon name="plus"></Icon>
                    </button>
                    <button
                      className="btn btn-outline-secondary d-flex justify-content-center align-items-center"
                      type="button"
                      data-index={index}
                      disabled={storeBook.bookAuthors.length === 1}
                      onClick={onRemoveAuthor}
                    >
                      <Icon name="minus"></Icon>
                    </button>
                  </div>
                ))
              }
              <div className={keywordsLength ? "mt-3" : ''}>
                <KeywordPicker keywords={keywords} onClick={onChangeAuthorsFromPicker}/>
              </div>
            </div>
          </div>
          <div className="mb-3 row">
            <label htmlFor="input-book-subject" className="col-sm-2 col-form-label text-end">{t.book.subject}</label>
            <div className="col-sm-10">
              <input type="text" className="form-control" list="dl-subject" id="input-book-subject" value={storeBook.bookSubject} onInput={onChangeBookSubject}/>
              <datalist id="dl-subject">
                <option value="少年" />
                <option value="少女" />
                <option value="青年" />
                <option value="同人誌" />
                <option value="漫画" />
                <option value="成年コミック" />
              </datalist>
            </div>
          </div>
          <div className="mb-3 row">
            <label htmlFor="input-book-publisher" className="col-sm-2 col-form-label text-end">{t.book.publisher}</label>
            <div className="col-sm-10">
              <input type="text" className="form-control" list="dl-publisher" id="input-book-publisher" value={storeBook.bookPublisher} onInput={onChangeBookPublisher}/>
              <datalist id="dl-publisher">
                <option value="KADOKAWA" />
                <option value="講談社" />
                <option value="集英社" />
                <option value="小学館" />
                <option value="小学館集英社プロダクション" />
                <option value="少年画報社" />
                <option value="松文館" />
                <option value="日本文芸社" />
                <option value="白泉社" />
                <option value="芳文社" />
                <option value="ワニマガジン社" />
                <option value="FAKKU" />
              </datalist>
              <div className={keywordsLength ? "mt-3" : ''}>
                <KeywordPicker keywords={keywords} onClick={onChangePublisherFromPicker}/>
              </div>
            </div>
          </div>
          <div className="mb-3 row">
            <label htmlFor="input-book-language" className="col-sm-2 col-form-label text-end">{t.book.language}</label>
            <div className="col-sm-10">
              <input
                type="text"
                className="form-control"
                list="dl-language"
                id="input-book-language"
                value={storeBook.bookLanguage}
                onInput={onChangeBookLanguage}
              />
              <datalist id="dl-language">
                <option value="ja" />
                <option value="zh-CN" />
                <option value="zh-TW" />
                <option value="en" />
                <option value="ko" />
              </datalist>
            </div>
          </div>
        </div>
        <div className="modal-footer justify-content-start">
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={onClickSaveSet}>{t.book.saveSet}</button>
          <select className="form-select form-select-sm" value={selectedSetIndex + ''} defaultChecked={false} ref={setsSeletRef} style={{width: '200px'}} onChange={onApplySet}>
            {
              storeBook.savedSets.map((set, index) =>
                <option defaultChecked={false} key={index} value={index}>title: {set.bookTitle}, author: {set.bookAuthors[0]}, subject: {set.bookSubject}</option>
              )
            }
          </select>
          <button type="button" disabled={selectedSetIndex === -1} className="btn btn-sm btn-outline-danger" onClick={onClickRemoveSet}>{t.book.removeSet}</button>
        </div>
      </div>
    </div>
  );
});

export default ModalBook;
