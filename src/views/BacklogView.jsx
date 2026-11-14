import InstagramSaved from '../components/backlog/InstagramSaved';
import NotionBacklog from '../components/backlog/NotionBacklog';
import PhotoHistory from '../components/backlog/PhotoHistory';
import PhotoAlbums from '../components/backlog/PhotoAlbums';
import styles from './BacklogView.module.css';

// Three columns: Fotos (daily chart, then the albums), Instagram (chart, then
// the table by collection) and the Notion table.
export default function BacklogView({ state, dispatch, instagram, notionBacklog, photoAlbums }) {
  return (
    <div className={styles.trio}>
      <div className={styles.col}>
        <PhotoHistory photos={photoAlbums} />
        <PhotoAlbums photos={photoAlbums} open={Boolean(state.fotosAlbumsOpen)} onOpenChange={(value) => dispatch({ type: 'SET_FLAG', key: 'fotosAlbumsOpen', value })} />
      </div>
      <InstagramSaved instagram={instagram} />
      <div className={styles.col}>
        <NotionBacklog
          notion={notionBacklog}
          opened={state.notionBacklogOpen || {}}
          onOpenedChange={(value) => dispatch({ type: 'SET_FLAG', key: 'notionBacklogOpen', value })}
        />
      </div>
    </div>
  );
}
