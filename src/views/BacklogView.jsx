import InstagramSaved from '../components/backlog/InstagramSaved';
import { InstagramChip, PhotosChip } from '../components/backlog/BacklogChips';
import NotionBacklog from '../components/backlog/NotionBacklog';
import PhotoHistory from '../components/backlog/PhotoHistory';
import PhotoAlbums from '../components/backlog/PhotoAlbums';
import styles from './BacklogView.module.css';

export default function BacklogView({ state, dispatch, instagram, notionBacklog, photoAlbums }) {
  return (
    <>
      <div className={styles.chips}>
        <InstagramChip instagram={instagram} />
        <PhotosChip photos={photoAlbums} />
      </div>
      <div className={styles.trio}>
        <div className={styles.leftCol}>
          <NotionBacklog
            notion={notionBacklog}
            opened={state.notionBacklogOpen || {}}
            onOpenedChange={(value) => dispatch({ type: 'SET_FLAG', key: 'notionBacklogOpen', value })}
          />
          <PhotoAlbums photos={photoAlbums} open={Boolean(state.fotosAlbumsOpen)} onOpenChange={(value) => dispatch({ type: 'SET_FLAG', key: 'fotosAlbumsOpen', value })} />
        </div>
        <InstagramSaved instagram={instagram} below={<PhotoHistory photos={photoAlbums} />} />
      </div>
    </>
  );
}
